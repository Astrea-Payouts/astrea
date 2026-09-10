//! The event state machine: creation, the pre-launch/in-progress
//! transitions, the two ways an event can unwind before it starts
//! (`set_event_cancelled`, `emergency_withdraw`), and the read helpers.
//! `release_reward`/`release_compensation` live in `rewards.rs` instead —
//! they're the two ways an event's `reward` actually leaves the contract
//! for good, a different concern from the state transitions themselves.

use crate::access::{
    assert_not_paused, assert_token_allowed, bump_event_ttl, bump_events_index_ttl,
    bump_wallet_ttl, get_default_resolver,
};
use crate::events::{
    EmergencyWithdrawal, EventCancelled, EventCreated, EventExpired, EventStarted,
    EventWaitingForStart,
};
use crate::types::{AdminWallet, DataKey, Event, EventState};
use soroban_sdk::{Address, BytesN, Env, Vec};

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

    assert!(
        event.state == EventState::Created
            || event.state == EventState::WaitingForStart
            || event.state == EventState::InProgress,
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

pub(crate) fn set_event_in_progress(env: Env, admin: Address, event_id: BytesN<16>) {
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

    event.state = EventState::InProgress;

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);

    EventStarted { event_id, admin }.publish(&env);
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
