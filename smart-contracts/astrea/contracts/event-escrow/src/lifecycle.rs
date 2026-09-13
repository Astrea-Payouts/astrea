//! The event state machine: creation, the pre-launch/in-progress
//! transitions, the two ways an event can unwind before it starts
//! (`set_event_cancelled`, `emergency_withdraw`), and the read helpers.
//! `release_reward`/`release_compensation` live in `rewards.rs` instead —
//! they're the two ways an event's `reward` actually leaves the contract
//! for good, a different concern from the state transitions themselves.

use crate::access::{
    assert_not_paused, assert_token_allowed, bump_event_ttl, bump_events_index_ttl,
    bump_wallet_ttl, get_default_resolver, get_fee_bps, get_treasury,
};
use crate::events::{
    EmergencyWithdrawal, EventCancelled, EventCreated, EventExpired, EventStarted,
    EventWaitingForStart, FeeCharged,
};
use crate::types::{AdminWallet, DataKey, Event, EventState};
use soroban_sdk::{token::TokenClient, Address, BytesN, Env, Vec};

// 8 params is inherent to create_event's public signature (admin, judge,
// resolver, token, reward, event_id, deadline, plus env) — not something a
// param-bundling struct would meaningfully shrink for a Soroban contract
// entry point, since each field is independently supplied by the caller.
// (clippy::too_many_arguments is allowed crate-wide in lib.rs for this
// exact reason — see the comment there.)
fn create_event_internal(
    env: Env,
    admin: Address,
    judge: Address,
    resolver: Option<Address>,
    token: Address,
    reward: i128,
    event_id: BytesN<16>,
    deadline: Option<u64>,
) -> BytesN<16> {
    admin.require_auth();

    assert_not_paused(&env, &admin);

    assert_token_allowed(&env, &token);

    assert!(reward > 0, "Reward must be greater than zero");

    if let Some(d) = deadline {
        assert!(
            d > env.ledger().timestamp(),
            "Deadline must be in the future"
        );
    }

    let event_key = DataKey::Event(event_id.clone());

    assert!(
        !env.storage().persistent().has(&event_key),
        "Event already exists"
    );

    let wallet_key = DataKey::Wallet(admin.clone());

    let mut wallet: AdminWallet = env
        .storage()
        .persistent()
        .get(&wallet_key)
        .expect("Admin must deposit funds before the event");

    assert!(
        wallet.token == token,
        "Admin wallet token doesn't match the event's token"
    );

    assert!(
        wallet.balance >= reward,
        "Insufficient balance in wallet to create event"
    );

    wallet.balance -= reward;

    env.storage().persistent().set(&wallet_key, &wallet);

    bump_wallet_ttl(&env, &wallet_key);

    // E01b: fall back to Astrea's own resolver when the organizer doesn't
    // name one explicitly (ADR-003).
    let resolver = resolver.unwrap_or_else(|| get_default_resolver(&env));

    let event = Event {
        admin: admin.clone(),
        judge,
        token,
        resolver,
        reward,
        state: EventState::Created,
        deadline,
        judging_deadline: None,
    };

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);
    let count_key = DataKey::EventsCount(admin.clone());
    let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
    let index_key = DataKey::EventIndex(admin.clone(), count);

    env.storage().persistent().set(&index_key, &event_id);
    bump_events_index_ttl(&env, &index_key);

    env.storage().persistent().set(&count_key, &(count + 1));
    bump_events_index_ttl(&env, &count_key);

    EventCreated {
        event_id: event_id.clone(),
        admin: admin.clone(),
        reward: event.reward,
    }
    .publish(&env);

    event_id
}

pub(crate) fn create_event(
    env: Env,
    admin: Address,
    judge: Address,
    resolver: Option<Address>,
    token: Address,
    reward: i128,
    event_id: BytesN<16>,
) -> BytesN<16> {
    create_event_internal(env, admin, judge, resolver, token, reward, event_id, None)
}

pub(crate) fn create_event_with_deadline(
    env: Env,
    admin: Address,
    judge: Address,
    resolver: Option<Address>,
    token: Address,
    reward: i128,
    event_id: BytesN<16>,
    deadline: u64,
) -> BytesN<16> {
    create_event_internal(
        env,
        admin,
        judge,
        resolver,
        token,
        reward,
        event_id,
        Some(deadline),
    )
}

pub(crate) fn expire_event(env: Env, event_id: BytesN<16>) {
    let event_key = DataKey::Event(event_id.clone());

    let mut event: Event = env
        .storage()
        .persistent()
        .get(&event_key)
        .expect("Event does not exist");

    // InProgress is deliberately excluded: once a resolver-dispute path
    // exists (resolve_dispute in rewards.rs), a permissionless bare refund
    // of a live event would both violate ADR-006 and let anyone front-run
    // the resolver by refunding the organizer right after the deadline.
    // Created and WaitingForStart still expire as before.
    assert!(
        event.state == EventState::Created || event.state == EventState::WaitingForStart,
        "Event cannot be expired in its current state"
    );

    let deadline = event.deadline.expect("Event has no deadline configured");

    assert!(
        env.ledger().timestamp() >= deadline,
        "Event deadline has not passed yet"
    );

    event.state = EventState::Cancelled;

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);

    let wallet_key = DataKey::Wallet(event.admin.clone());

    let mut wallet: AdminWallet = env
        .storage()
        .persistent()
        .get(&wallet_key)
        .expect("Admin has no wallet registered");

    wallet.balance += event.reward;

    env.storage().persistent().set(&wallet_key, &wallet);

    bump_wallet_ttl(&env, &wallet_key);

    EventExpired {
        event_id,
        admin: event.admin,
        reward: event.reward,
    }
    .publish(&env);
}

pub(crate) fn set_event_waiting_for_start(env: Env, admin: Address, event_id: BytesN<16>) {
    admin.require_auth();

    assert_not_paused(&env, &admin);

    let event_key = DataKey::Event(event_id.clone());

    let mut event: Event = env
        .storage()
        .persistent()
        .get(&event_key)
        .expect("Event does not exist");

    assert_eq!(
        event.admin, admin,
        "Only the event admin can update the event"
    );

    assert_eq!(
        event.state,
        EventState::Created,
        "Event must be in Created state to wait for start"
    );

    event.state = EventState::WaitingForStart;

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);

    EventWaitingForStart { event_id, admin }.publish(&env);
}

pub(crate) fn set_event_in_progress(
    env: Env,
    admin: Address,
    event_id: BytesN<16>,
    judging_deadline: u64,
) {
    admin.require_auth();

    assert_not_paused(&env, &admin);

    let event_key = DataKey::Event(event_id.clone());

    let mut event: Event = env
        .storage()
        .persistent()
        .get(&event_key)
        .expect("Event does not exist");

    assert_eq!(
        event.admin, admin,
        "Only the event admin can start the event"
    );

    assert!(
        event.state == EventState::Created || event.state == EventState::WaitingForStart,
        "Event must be in Created or WaitingForStart state to start"
    );

    assert!(
        judging_deadline > env.ledger().timestamp(),
        "Judging deadline must be in the future"
    );

    // Go-live fee (ADR-003 / PR #178 follow-up): charged once, here, in
    // exchange for Astrea standing as the event's resolver from this point
    // on. On top of the prize, never out of it — it comes from the
    // organizer's free wallet balance, not the `reward` already reserved
    // by `create_event`, so `release_reward`/`resolve_dispute` keep paying
    // exactly `reward`. Non-refundable: nothing in `resolve_dispute`,
    // `expire_event` or `release_compensation` returns it. The balance
    // check below must run before the state change, so a rejected go-live
    // leaves the event in its pre-launch state.
    let fee_bps = get_fee_bps(&env);
    let fee = event.reward * i128::from(fee_bps) / 10_000;

    let treasury = if fee > 0 {
        // Fail closed: an unset treasury must never silently mean "free".
        let treasury = get_treasury(&env);

        let wallet_key = DataKey::Wallet(admin.clone());

        let mut wallet: AdminWallet = env
            .storage()
            .persistent()
            .get(&wallet_key)
            .expect("Admin has no wallet registered");

        assert!(
            wallet.balance >= fee,
            "Insufficient balance to cover the go-live fee"
        );

        wallet.balance -= fee;

        env.storage().persistent().set(&wallet_key, &wallet);

        bump_wallet_ttl(&env, &wallet_key);

        let token_client = TokenClient::new(&env, &event.token);
        token_client.transfer(&env.current_contract_address(), &treasury, &fee);

        Some(treasury)
    } else {
        None
    };

    event.state = EventState::InProgress;
    event.judging_deadline = Some(judging_deadline);

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);

    EventStarted {
        event_id: event_id.clone(),
        admin: admin.clone(),
    }
    .publish(&env);

    if let Some(treasury) = treasury {
        FeeCharged {
            event_id,
            admin,
            treasury,
            fee,
        }
        .publish(&env);
    }
}

/// Read-only quote of what `set_event_in_progress` would charge this event
/// right now, at the current `fee_bps`. Lets the UI/off-chain service tell
/// the organizer "deposit reward + fee" before they sign anything.
pub(crate) fn quote_go_live_fee(env: Env, event_id: BytesN<16>) -> i128 {
    let event: Event = env
        .storage()
        .persistent()
        .get(&DataKey::Event(event_id))
        .expect("Event does not exist");

    let fee_bps = get_fee_bps(&env);

    event.reward * i128::from(fee_bps) / 10_000
}

pub(crate) fn set_event_cancelled(env: Env, admin: Address, event_id: BytesN<16>) {
    admin.require_auth();

    assert_not_paused(&env, &admin);

    let event_key = DataKey::Event(event_id.clone());

    let mut event: Event = env
        .storage()
        .persistent()
        .get(&event_key)
        .expect("Event does not exist");

    assert_eq!(
        event.admin, admin,
        "Only the event admin can cancel the event"
    );

    // InProgress is deliberately excluded: cancelling a live event with an
    // automatic, unconditional refund would let an organizer extract
    // participants' already-invested work for free (ADR-006). Once an
    // event is InProgress, unwinding it requires a resolver-adjudicated
    // dispute instead (build-plan.md E01d/#22) — not implemented yet, so
    // for now an InProgress event simply cannot be cancelled at all. That
    // is the correct, safe interim state (fails closed).
    assert!(
        event.state == EventState::Created || event.state == EventState::WaitingForStart,
        "Event cannot be cancelled in its current state"
    );

    event.state = EventState::Cancelled;

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);

    let wallet_key = DataKey::Wallet(admin.clone());

    let mut wallet: AdminWallet = env
        .storage()
        .persistent()
        .get(&wallet_key)
        .expect("Admin has no wallet registered");

    wallet.balance += event.reward;

    env.storage().persistent().set(&wallet_key, &wallet);

    bump_wallet_ttl(&env, &wallet_key);

    EventCancelled {
        event_id,
        admin: admin.clone(),
        reward: event.reward,
    }
    .publish(&env);
}

/// E01b — pre-launch two-signature emergency withdraw.
///
/// Reuses the exact same "pre-launch" gate as `set_event_cancelled`
/// (`Created || WaitingForStart`) on purpose — the two functions must
/// never disagree about what "pre-launch" means. Once an event reaches
/// `InProgress` there is deliberately no unwind path at all until the
/// resolver-adjudicated dispute flow (#22) exists (ADR-006).
///
/// Both signatures are required and checked independently: neither the
/// organizer nor the resolver can move funds unilaterally (ADR-003).
/// The event's own `admin`/`resolver` fields are checked against the
/// callers, not just "some admin"/"some resolver" in the system, so one
/// event's resolver can't authorize a withdraw on a different event.
///
/// Funds move back into the organizer's `AdminWallet.balance` rather
/// than transferring out of the contract directly — consistent with
/// `set_event_cancelled` and `expire_event`, which do the same, since
/// the tokens are already custodied by the contract and this is purely
/// an internal accounting move.
pub(crate) fn emergency_withdraw(
    env: Env,
    admin: Address,
    resolver: Address,
    event_id: BytesN<16>,
    amount: i128,
) {
    admin.require_auth();
    resolver.require_auth();

    assert_not_paused(&env, &admin);

    assert!(amount > 0, "Amount must be greater than zero");

    let event_key = DataKey::Event(event_id.clone());

    let mut event: Event = env
        .storage()
        .persistent()
        .get(&event_key)
        .expect("Event does not exist");

    assert_eq!(
        event.admin, admin,
        "Only the event's admin can request an emergency withdraw"
    );

    assert_eq!(
        event.resolver, resolver,
        "Only the event's resolver can approve an emergency withdraw"
    );

    assert!(
        event.state == EventState::Created || event.state == EventState::WaitingForStart,
        "Emergency withdraw is only allowed before the event starts"
    );

    assert!(
        amount <= event.reward,
        "Amount exceeds the event's reserved reward"
    );

    event.reward -= amount;

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);

    let wallet_key = DataKey::Wallet(admin.clone());

    let mut wallet: AdminWallet = env
        .storage()
        .persistent()
        .get(&wallet_key)
        .expect("Admin has no wallet registered");

    wallet.balance += amount;

    env.storage().persistent().set(&wallet_key, &wallet);

    bump_wallet_ttl(&env, &wallet_key);

    EmergencyWithdrawal {
        event_id,
        admin: admin.clone(),
        resolver,
        amount,
    }
    .publish(&env);
}

pub(crate) fn get_events_by_admin(env: Env, admin: Address) -> Vec<BytesN<16>> {
    let count: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::EventsCount(admin.clone()))
        .unwrap_or(0);

    let mut result: Vec<BytesN<16>> = Vec::new(&env);

    for i in 0..count {
        let id: BytesN<16> = env
            .storage()
            .persistent()
            .get(&DataKey::EventIndex(admin.clone(), i))
            .unwrap();

        result.push_back(id);
    }

    result
}

pub(crate) fn get_events_by_admin_page(
    env: Env,
    admin: Address,
    offset: u32,
    limit: u32,
) -> Vec<BytesN<16>> {
    let count: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::EventsCount(admin.clone()))
        .unwrap_or(0);

    let requested_end = offset.saturating_add(limit);

    let end = if requested_end < count {
        requested_end
    } else {
        count
    };

    let mut result: Vec<BytesN<16>> = Vec::new(&env);

    let mut i = offset;

    while i < end {
        let id: BytesN<16> = env
            .storage()
            .persistent()
            .get(&DataKey::EventIndex(admin.clone(), i))
            .unwrap();

        result.push_back(id);

        i += 1;
    }

    result
}

pub(crate) fn get_events_by_admin_count(env: Env, admin: Address) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::EventsCount(admin))
        .unwrap_or(0)
}

pub(crate) fn get_event(env: Env, event_id: BytesN<16>) -> Event {
    env.storage()
        .persistent()
        .get(&DataKey::Event(event_id))
        .expect("Event does not exist")
}
