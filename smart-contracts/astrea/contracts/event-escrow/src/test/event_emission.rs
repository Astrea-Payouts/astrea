//! Tests asserting the lifecycle/governance events are actually
//! published (EventCreated, EventExpired, EventWaitingForStart,
//! EventStarted, EventCancelled, ContractPaused, AdminPaused). The
//! reward/compensation events live in `rewards.rs`'s own test file
//! instead, next to the functions that emit them.

use super::common::*;
use crate::*;
use soroban_sdk::testutils::{Address as _, Events as _, Ledger as _};
use soroban_sdk::{Address, Env, Event as _};

#[test]
fn test_event_created_is_emitted() {
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

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [EventCreated {
            event_id: event_id.clone(),
            admin: admin.clone(),
            reward: 300,
        }
        .to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_event_expired_is_emitted() {
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

    env.ledger().with_mut(|li| li.timestamp = deadline + 1);
    client.expire_event(&event_id);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [EventExpired {
            event_id: event_id.clone(),
            admin: admin.clone(),
            reward: 300,
        }
        .to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_event_waiting_for_start_is_emitted() {
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

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [EventWaitingForStart {
            event_id: event_id.clone(),
            admin: admin.clone(),
        }
        .to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_event_started_is_emitted() {
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

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [EventStarted {
            event_id: event_id.clone(),
            admin: admin.clone(),
        }
        .to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_event_cancelled_is_emitted() {
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
    client.set_event_cancelled(&admin, &event_id);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [EventCancelled {
            event_id: event_id.clone(),
            admin: admin.clone(),
            reward: 300,
        }
        .to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_contract_paused_event_is_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_paused(&emergency_admin, &true);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [ContractPaused { paused: true }.to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_admin_paused_event_is_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let target_admin = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_admin_paused(&emergency_admin, &target_admin, &true);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [AdminPaused {
            admin: target_admin.clone(),
            paused: true,
        }
        .to_xdr(&env, &contract_id)],
    );
}
