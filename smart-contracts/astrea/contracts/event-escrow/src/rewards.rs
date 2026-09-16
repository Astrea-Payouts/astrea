//! The two ways an event's reserved `reward` leaves the contract for good:
//! `release_reward` (judge pays 1..N winners once `InProgress`) and
//! `release_compensation` (admin pays back participants after a
//! cancellation). Kept apart from `lifecycle.rs` because these move
//! tokens out via `TokenClient::transfer`, not just internal accounting.

use crate::access::{assert_not_paused, bump_event_ttl, bump_wallet_ttl};
use crate::events::{CompensationReleased, DisputeResolved, RewardReleased};
use crate::types::{AdminWallet, DataKey, Event, EventState, Participants, Winner};
use soroban_sdk::{token::TokenClient, Address, BytesN, Env, Vec};

/// K06 (spikes/k06-multi-release-budget) validated a single `release_reward`
/// call paying up to 25 winners stays well inside the Stellar Mainnet
/// instruction budget (~1.2% of it). This is an on-chain enforcement of
/// that validated bound, not an arbitrary limit — an unbounded winners
/// list is a griefing vector: a judge could submit a list large enough to
/// blow the transaction's resource budget mid-call, aborting a legitimate
/// event close with no recovery path until the dispute mechanism (#22)
/// exists.
const MAX_WINNERS: u32 = 25;

/// Shared by `release_reward` and `resolve_dispute` — both pay out a
/// event's locked `reward` in full, in one call, and must agree on what
/// makes a winners list valid. Returns the validated total so callers
/// don't recompute the sum.
fn validate_and_sum_winners(winners: &Vec<Winner>, expected_total: i128) -> i128 {
    assert!(
        winners.len() <= MAX_WINNERS,
        "Too many winners in a single release"
    );

    for winner in winners.iter() {
        assert!(winner.amount > 0, "Winner amount must be greater than zero");
    }

    let total_distributed: i128 = winners.iter().map(|w| w.amount).sum();

    assert_eq!(
        total_distributed, expected_total,
        "Distributed amount does not match the locked reward"
    );

    total_distributed
}

/// Shared transfer loop for `release_reward` and `resolve_dispute`.
fn transfer_to_winners(env: &Env, token: &Address, winners: &Vec<Winner>) {
    let token_client = TokenClient::new(env, token);

    for winner in winners.iter() {
        token_client.transfer(
            &env.current_contract_address(),
            &winner.address,
            &winner.amount,
        );
    }
}

pub(crate) fn release_compensation(
    env: Env,
    admin: Address,
    event_id: BytesN<16>,
    participants: Vec<Participants>,
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
        "Only admin can release the compensation"
    );

    assert_eq!(event.state, EventState::Cancelled, "Event is not cancelled");

    assert!(!participants.is_empty(), "No participants provided");

    for p in participants.iter() {
        assert!(
            p.amount_compensation > 0,
            "Compensation must be greater than zero"
        );
    }

    let total: i128 = participants.iter().map(|p| p.amount_compensation).sum();

    let wallet_key = DataKey::Wallet(admin.clone());

    let mut wallet: AdminWallet = env
        .storage()
        .persistent()
        .get(&wallet_key)
        .expect("Admin has no wallet registered");

    assert!(
        wallet.balance >= total,
        "Insufficient wallet balance to cover compensation"
    );

    wallet.balance -= total;

    env.storage().persistent().set(&wallet_key, &wallet);

    bump_wallet_ttl(&env, &wallet_key);

    let token_client = TokenClient::new(&env, &wallet.token);

    for p in participants.iter() {
        token_client.transfer(
            &env.current_contract_address(),
            &p.address,
            &p.amount_compensation,
        );
    }

    event.state = EventState::Compensated;

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);

    CompensationReleased {
        event_id,
        admin: admin.clone(),
        total,
    }
    .publish(&env);
}

pub(crate) fn release_reward(env: Env, judge: Address, event_id: BytesN<16>, winners: Vec<Winner>) {
    judge.require_auth();

    let event_key = DataKey::Event(event_id.clone());

    let mut event: Event = env
        .storage()
        .persistent()
        .get(&event_key)
        .expect("Event does not exist");

    assert_not_paused(&env, &event.admin);

    assert!(
        event.judge == judge,
        "Only the event's judge can release rewards"
    );

    assert!(
        event.state == EventState::InProgress,
        "Event is not ready to release rewards"
    );

    let total_distributed = validate_and_sum_winners(&winners, event.reward);

    event.state = EventState::Ended;
    env.storage().persistent().set(&event_key, &event);
    bump_event_ttl(&env, &event_key);

    transfer_to_winners(&env, &event.token, &winners);

    RewardReleased {
        event_id,
        admin: event.admin.clone(),
        total_distributed,
    }
    .publish(&env);
}

/// The resolver-signed way for a live event's funds to reach the intended
/// recipients when the judge never signs `release_reward` (ADR-003). Also
/// covers cancel-after-launch: the resolver can name the organizer's own
/// address as a "winner" if that's the fair distribution (ADR-006) — there
/// is deliberately no separate refund code path for that case.
///
/// Shares its winners validation and transfer loop with `release_reward`
/// (`validate_and_sum_winners` / `transfer_to_winners`) so the two payout
/// paths can't drift on what counts as a valid distribution.
pub(crate) fn resolve_dispute(
    env: Env,
    resolver: Address,
    event_id: BytesN<16>,
    winners: Vec<Winner>,
) {
    resolver.require_auth();

    let event_key = DataKey::Event(event_id.clone());

    let mut event: Event = env
        .storage()
        .persistent()
        .get(&event_key)
        .expect("Event does not exist");

    // Same gate as release_reward: a recovery path that moves funds to
    // arbitrary addresses is exactly what the pause exists to stop.
    assert_not_paused(&env, &event.admin);

    assert!(
        event.resolver == resolver,
        "Only the event's resolver can resolve a dispute"
    );

    assert!(
        event.state == EventState::InProgress,
        "Event is not ready to resolve a dispute"
    );

    let judging_deadline = event
        .judging_deadline
        .expect("Event has no judging deadline configured");

    assert!(
        env.ledger().timestamp() >= judging_deadline,
        "Judging deadline has not passed yet"
    );

    let total_distributed = validate_and_sum_winners(&winners, event.reward);

    event.state = EventState::Ended;
    env.storage().persistent().set(&event_key, &event);
    bump_event_ttl(&env, &event_key);

    transfer_to_winners(&env, &event.token, &winners);

    DisputeResolved {
        event_id,
        resolver,
        total_distributed,
    }
    .publish(&env);
}
