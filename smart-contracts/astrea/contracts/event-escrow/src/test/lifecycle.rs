//! Tests for `lifecycle.rs`: create_event*, the state transitions
//! (waiting_for_start / in_progress / cancelled), expire_event, and the
//! get_event* read helpers.

use super::common::*;
use crate::*;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, Env};

#[test]
fn test_create_event_deducts_from_reserve_and_returns_the_given_id() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);

    let id_1 = test_event_id(&env, 1);

    let id_2 = test_event_id(&env, 2);

    let returned_1 = client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &id_1,
    );

    let returned_2 = client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &200,
        &id_2,
    );

    assert_eq!(returned_1, id_1);

    assert_eq!(returned_2, id_2);

    assert_eq!(client.get_balance(&admin), 500);
}

#[test]
#[should_panic(expected = "Event already exists")]
fn test_create_event_rejects_duplicate_id() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);

    let id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &200,
        &id,
    );

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &100,
        &id,
    );
}

#[test]
#[should_panic(expected = "Insufficient balance in wallet to create event")]
fn test_create_event_rejects_insufficient_balance() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &100);

    let id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &id,
    );
}

#[test]
#[should_panic(expected = "Reward must be greater than zero")]
fn test_create_event_rejects_negative_reward() {
    // A negative reward would make `wallet.balance -= reward` INCREASE the
    // caller's balance with no deposit — a fund-creation exploit, not just
    // an input-validation nicety. See docs/contracts-build-plan.md's L01
    // findings log.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &100);

    let id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &-500,
        &id,
    );
}

#[test]
#[should_panic(expected = "Reward must be greater than zero")]
fn test_create_event_rejects_zero_reward() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &100);

    let id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &0,
        &id,
    );
}

#[test]
#[should_panic(expected = "Admin must deposit funds before the event")]
fn test_create_event_without_prior_deposit() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, _asset_client) = create_test_token(&env, &token_admin);

    let id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &100,
        &id,
    );
}

#[test]
#[should_panic(expected = "Admin wallet token doesn't match the event's token")]
fn test_create_event_rejects_token_mismatched_with_wallet() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_a, _client_a, asset_a) = create_test_token(&env, &token_admin);

    let (token_b, _client_b, _asset_b) = create_test_token(&env, &token_admin);

    asset_a.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_a, &500);

    let id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_b,
        &100,
        &id,
    );
}

#[test]
fn test_get_events_by_admin_returns_all_created_events() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);

    let id_1 = test_event_id(&env, 1);

    let id_2 = test_event_id(&env, 2);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &200,
        &id_1,
    );

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &id_2,
    );

    let events = client.get_events_by_admin(&admin);

    assert_eq!(events.len(), 2);

    assert_eq!(events.get(0).unwrap(), id_1);

    assert_eq!(events.get(1).unwrap(), id_2);
}

#[test]
fn test_get_events_by_admin_returns_empty_for_unknown_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let events = client.get_events_by_admin(&admin);

    assert_eq!(events.len(), 0);
}

#[test]
fn test_get_events_by_admin_does_not_mix_different_admins() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin_1 = Address::generate(&env);

    let admin_2 = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin_1, &1_000);

    asset_client.mint(&admin_2, &1_000);

    client.deposit_funds(&admin_1, &token_address, &1_000);

    client.deposit_funds(&admin_2, &token_address, &1_000);

    let id_1 = test_event_id(&env, 1);

    let id_2 = test_event_id(&env, 2);

    client.create_event(
        &admin_1,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &100,
        &id_1,
    );

    client.create_event(
        &admin_2,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &100,
        &id_2,
    );

    let events_admin_1 = client.get_events_by_admin(&admin_1);

    let events_admin_2 = client.get_events_by_admin(&admin_2);

    assert_eq!(events_admin_1.len(), 1);

    assert_eq!(events_admin_1.get(0).unwrap(), id_1);

    assert_eq!(events_admin_2.len(), 1);

    assert_eq!(events_admin_2.get(0).unwrap(), id_2);
}

#[test]
fn test_set_event_waiting_for_start_transitions_from_created() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_waiting_for_start(&admin, &event_id);

    client.set_event_in_progress(&admin, &event_id);
}

#[test]
#[should_panic(expected = "Event must be in Created state to wait for start")]
fn test_set_event_waiting_for_start_rejects_double_call() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_waiting_for_start(&admin, &event_id);

    client.set_event_waiting_for_start(&admin, &event_id);
}

#[test]
#[should_panic(expected = "Only the event admin can update the event")]
fn test_set_event_waiting_for_start_rejects_wrong_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let impostor_admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_waiting_for_start(&impostor_admin, &event_id);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_set_event_waiting_for_start_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let event_id = test_event_id(&env, 99);

    client.set_event_waiting_for_start(&admin, &event_id);
}

#[test]
fn test_set_event_in_progress_allows_release_reward_afterwards() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let judge = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_in_progress(&admin, &event_id);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 300,

            address: winner_address.clone()
        },
    ];

    client.release_reward(&judge, &event_id, &winners);

    assert_eq!(token_client.balance(&winner_address), 300);
}

#[test]
fn test_set_event_in_progress_allows_transition_from_waiting_for_start() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let judge = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_waiting_for_start(&admin, &event_id);

    client.set_event_in_progress(&admin, &event_id);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 300,

            address: winner_address.clone()
        },
    ];

    client.release_reward(&judge, &event_id, &winners);

    assert_eq!(token_client.balance(&winner_address), 300);
}

#[test]
#[should_panic(expected = "Event must be in Created or WaitingForStart state to start")]
fn test_set_event_in_progress_rejects_double_start() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_in_progress(&admin, &event_id);

    client.set_event_in_progress(&admin, &event_id);
}

#[test]
#[should_panic(expected = "Only the event admin can start the event")]
fn test_set_event_in_progress_rejects_wrong_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let impostor_admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_in_progress(&impostor_admin, &event_id);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_set_event_in_progress_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let event_id = test_event_id(&env, 99);

    client.set_event_in_progress(&admin, &event_id);
}

#[test]
fn test_set_event_cancelled_refunds_wallet_from_created_state() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    assert_eq!(client.get_balance(&admin), 200);

    client.set_event_cancelled(&admin, &event_id);

    assert_eq!(client.get_balance(&admin), 500);
}

#[test]
fn test_set_event_cancelled_refunds_wallet_from_waiting_for_start_state() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_waiting_for_start(&admin, &event_id);

    client.set_event_cancelled(&admin, &event_id);

    assert_eq!(client.get_balance(&admin), 500);
}

#[test]
#[should_panic(expected = "Event cannot be cancelled in its current state")]
fn test_set_event_cancelled_rejects_in_progress_state() {
    // ADR-006: cancelling a live (InProgress) event with an automatic,
    // unconditional refund would let an organizer extract participants'
    // already-invested work for free. Once InProgress, this function must
    // reject the cancellation — unwinding a live event requires a
    // resolver-adjudicated dispute instead (see #22 / build-plan.md E01d,
    // not implemented yet), never a bare refund to the organizer.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_in_progress(&admin, &event_id);

    client.set_event_cancelled(&admin, &event_id);
}

#[test]
#[should_panic(expected = "Only the event admin can cancel the event")]
fn test_set_event_cancelled_rejects_wrong_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let impostor_admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_cancelled(&impostor_admin, &event_id);
}

#[test]
#[should_panic(expected = "Event cannot be cancelled in its current state")]
fn test_set_event_cancelled_rejects_already_ended_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );

    force_event_state(&env, &contract_id, event_id.clone(), EventState::Ended);

    client.set_event_cancelled(&admin, &event_id);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_set_event_cancelled_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let event_id = test_event_id(&env, 99);

    client.set_event_cancelled(&admin, &event_id);
}

#[test]
fn test_get_event_returns_current_state() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
    );
    let event = client.get_event(&event_id);

    assert_eq!(event.admin, admin);
    assert_eq!(event.token, token_address);
    assert_eq!(event.reward, 300);
    assert_eq!(event.state, EventState::Created);

    client.set_event_cancelled(&admin, &event_id);
    let cancelled_event = client.get_event(&event_id);
    assert_eq!(cancelled_event.state, EventState::Cancelled);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_get_event_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let event_id = test_event_id(&env, 99);

    client.get_event(&event_id);
}

#[test]
fn test_expire_event_refunds_after_deadline() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    let deadline = env.ledger().timestamp() + 100;

    client.create_event_with_deadline(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &400,
        &event_id,
        &deadline,
    );
    assert_eq!(client.get_balance(&admin), 600);
    env.ledger().with_mut(|li| li.timestamp = deadline + 1);

    client.expire_event(&event_id);
    assert_eq!(client.get_balance(&admin), 1_000);
    let event = client.get_event(&event_id);
    assert_eq!(event.state, EventState::Cancelled);
}

#[test]
#[should_panic(expected = "Event deadline has not passed yet")]
fn test_expire_event_rejects_before_deadline() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    let deadline = env.ledger().timestamp() + 1_000;

    client.create_event_with_deadline(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &400,
        &event_id,
        &deadline,
    );
    client.expire_event(&event_id);
}

#[test]
#[should_panic(expected = "Event has no deadline configured")]
fn test_expire_event_rejects_event_without_deadline() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &400,
        &event_id,
    );
    client.expire_event(&event_id);
}

#[test]
#[should_panic(expected = "Deadline must be in the future")]
fn test_create_event_with_deadline_rejects_past_deadline() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let event_id = test_event_id(&env, 1);
    let past_deadline = 500u64;
    client.create_event_with_deadline(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &400,
        &event_id,
        &past_deadline,
    );
}

#[test]
fn test_get_events_by_admin_page_returns_bounded_slices() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);

    let mut ids = soroban_sdk::vec![&env];

    for n in 1..=5u8 {
        let id = test_event_id(&env, n);

        client.create_event(
            &admin,
            &Address::generate(&env),
            &Some(Address::generate(&env)),
            &token_address,
            &100,
            &id,
        );

        ids.push_back(id);
    }

    assert_eq!(client.get_events_by_admin_count(&admin), 5);
    let first_page = client.get_events_by_admin_page(&admin, &0, &2);
    assert_eq!(first_page.len(), 2);
    assert_eq!(first_page.get(0).unwrap(), ids.get(0).unwrap());
    assert_eq!(first_page.get(1).unwrap(), ids.get(1).unwrap());
    let second_page = client.get_events_by_admin_page(&admin, &2, &2);

    assert_eq!(second_page.len(), 2);
    assert_eq!(second_page.get(0).unwrap(), ids.get(2).unwrap());
    assert_eq!(second_page.get(1).unwrap(), ids.get(3).unwrap());

    let last_page = client.get_events_by_admin_page(&admin, &4, &10);
    assert_eq!(last_page.len(), 1);
    assert_eq!(last_page.get(0).unwrap(), ids.get(4).unwrap());
    let out_of_range_page = client.get_events_by_admin_page(&admin, &10, &5);
    assert_eq!(out_of_range_page.len(), 0);
    let all = client.get_events_by_admin(&admin);
    assert_eq!(all.len(), 5);
}

#[test]
fn test_expire_event_works_even_when_globally_paused() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    client.initialize_emergency_admin(&emergency_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);
    let deadline = env.ledger().timestamp() + 100;

    client.create_event_with_deadline(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id,
        &deadline,
    );
    client.set_paused(&emergency_admin, &true);

    env.ledger().with_mut(|li| li.timestamp = deadline + 1);
    client.expire_event(&event_id);

    assert_eq!(client.get_balance(&admin), 1_000);
}
