//! Tests for `rewards::resolve_dispute` (E01d / #22, narrowed scope): the
//! resolver-signed release of a live event's funds once `judging_deadline`
//! passes without the judge releasing them, plus the `judging_deadline`
//! plumbing in `set_event_in_progress` and `expire_event`'s narrowing
//! (that one lives in `test/lifecycle.rs`, next to the other expire tests).

use super::common::*;
use crate::*;
use soroban_sdk::testutils::{Address as _, Events as _, Ledger as _};
use soroban_sdk::{Address, Env, Event as _};

#[test]
fn test_resolve_dispute_pays_winners_after_deadline_and_ends_event() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);
    let first_place = Address::generate(&env);
    let second_place = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 300,
            address: first_place.clone()
        },
        Winner {
            place: 2,
            amount: 200,
            address: second_place.clone()
        },
    ];

    client.resolve_dispute(&resolver, &event_id, &winners);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [DisputeResolved {
            event_id: event_id.clone(),
            resolver: resolver.clone(),
            total_distributed: 500,
        }
        .to_xdr(&env, &contract_id)],
    );

    assert_eq!(token_client.balance(&first_place), 300);
    assert_eq!(token_client.balance(&second_place), 200);
    assert_eq!(client.get_event(&event_id).state, EventState::Ended);
}

#[test]
#[should_panic(expected = "Judging deadline has not passed yet")]
fn test_resolve_dispute_rejects_before_deadline() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address
        },
    ];

    client.resolve_dispute(&resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Only the event's resolver can resolve a dispute")]
fn test_resolve_dispute_rejects_wrong_resolver() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let impostor_resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address
        },
    ];

    client.resolve_dispute(&impostor_resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Only the event's resolver can resolve a dispute")]
fn test_resolve_dispute_rejects_judge_as_caller() {
    // The judge failing to release is exactly the scenario resolve_dispute
    // exists for — the judge must not be able to call it themselves.
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address
        },
    ];

    client.resolve_dispute(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Only the event's resolver can resolve a dispute")]
fn test_resolve_dispute_rejects_admin_as_caller() {
    // ADR-003: the organizer is never in the payout path, on either release
    // route.
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address
        },
    ];

    client.resolve_dispute(&admin, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event is not ready to resolve a dispute")]
fn test_resolve_dispute_rejects_event_not_in_progress() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );
    // Still Created — never moved to InProgress.

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address
        },
    ];

    client.resolve_dispute(&resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Distributed amount does not match the locked reward")]
fn test_resolve_dispute_rejects_mismatched_total() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 300,
            address: winner_address
        },
    ];

    client.resolve_dispute(&resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Winner amount must be greater than zero")]
fn test_resolve_dispute_rejects_zero_amount_winner() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 0,
            address: winner_address
        },
    ];

    client.resolve_dispute(&resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Too many winners in a single release")]
fn test_resolve_dispute_rejects_too_many_winners() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    let mut winners: Vec<Winner> = Vec::new(&env);
    for i in 0..26u32 {
        winners.push_back(Winner {
            place: i + 1,
            amount: 1,
            address: Address::generate(&env),
        });
    }

    client.resolve_dispute(&resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_resolve_dispute_rejects_when_globally_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    client.set_paused(&emergency_admin, &true);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address
        },
    ];

    client.resolve_dispute(&resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "This admin's operations are paused")]
fn test_resolve_dispute_rejects_when_admin_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    client.set_admin_paused(&emergency_admin, &admin, &true);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address
        },
    ];

    client.resolve_dispute(&resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event is not ready to release rewards")]
fn test_release_reward_rejects_after_resolve_dispute() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);
    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address.clone()
        },
    ];

    client.resolve_dispute(&resolver, &event_id, &winners);

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event is not ready to resolve a dispute")]
fn test_resolve_dispute_rejects_after_release_reward() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    let judging_deadline = env.ledger().timestamp() + 1_000;
    client.set_event_in_progress(&admin, &event_id, &judging_deadline);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 500,
            address: winner_address.clone()
        },
    ];

    // The judge releases before the deadline — release_reward carries no
    // deadline check of its own.
    client.release_reward(&judge, &event_id, &winners);

    env.ledger()
        .with_mut(|li| li.timestamp = judging_deadline + 1);

    client.resolve_dispute(&resolver, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Judging deadline must be in the future")]
fn test_set_event_in_progress_rejects_past_judging_deadline() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    env.ledger().with_mut(|li| li.timestamp = 1_000);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &500);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(resolver),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_in_progress(&admin, &event_id, &500u64);
}
