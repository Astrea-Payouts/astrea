//! The two ways an event's reserved `reward` leaves the contract for good:
//! `release_reward` (judge pays 1..N winners once `InProgress`) and
//! `release_compensation` (admin pays back participants after a
//! cancellation). Kept apart from `lifecycle.rs` because these move
//! tokens out via `TokenClient::transfer`, not just internal accounting.

use crate::access::{assert_not_paused, bump_event_ttl, bump_wallet_ttl};
use crate::events::{CompensationReleased, RewardReleased};
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

    assert!(
        winners.len() <= MAX_WINNERS,
        "Too many winners in a single release"
    );

    for winner in winners.iter() {
        assert!(winner.amount > 0, "Winner amount must be greater than zero");
    }

    let total_distributed: i128 = winners.iter().map(|w| w.amount).sum();

    assert_eq!(
        total_distributed, event.reward,
        "Distributed amount does not match the locked reward"
    );

    event.state = EventState::Ended;
    env.storage().persistent().set(&event_key, &event);
    bump_event_ttl(&env, &event_key);
    let token_client = TokenClient::new(&env, &event.token);

    for winner in winners.iter() {
        token_client.transfer(
            &env.current_contract_address(),
            &winner.address,
            &winner.amount,
        );
    }

    RewardReleased {
        event_id,
        admin: event.admin.clone(),
        total_distributed,
    }
    .publish(&env);
}
