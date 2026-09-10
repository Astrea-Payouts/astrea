//! Tests for `governance.rs`: pause (global and per-admin), the
//! emergency admin singleton, and the token whitelist.

use super::common::*;
use crate::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn test_emergency_pause_blocks_and_unblocks_writes() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    assert!(!client.is_paused());
    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    client.set_paused(&emergency_admin, &true);
    assert!(client.is_paused());

    let event_id = test_event_id(&env, 1);
    let result = client.try_create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &100,
        &event_id);

    assert!(result.is_err());
    client.set_paused(&emergency_admin, &false);
    assert!(!client.is_paused());
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &100,
        &event_id);
}

#[test]
#[should_panic(expected = "Emergency admin already initialized")]
fn test_initialize_emergency_admin_rejects_double_call() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin_1 = Address::generate(&env);
    let emergency_admin_2 = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin_1);
    client.initialize_emergency_admin(&emergency_admin_2);
}

#[test]
#[should_panic(expected = "Only the emergency admin can perform this action")]
fn test_set_paused_rejects_non_emergency_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let impostor = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_paused(&impostor, &true);
}

#[test]
#[should_panic(expected = "Only the emergency admin can perform this action")]
fn test_set_admin_paused_rejects_non_emergency_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let impostor = Address::generate(&env);
    let target_admin = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_admin_paused(&impostor, &target_admin, &true);
}

#[test]
#[should_panic(expected = "Only the emergency admin can perform this action")]
fn test_set_token_whitelist_enabled_rejects_non_emergency_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let impostor = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_token_whitelist_enabled(&impostor, &true);
}

#[test]
#[should_panic(expected = "Only the emergency admin can perform this action")]
fn test_set_token_allowed_rejects_non_emergency_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let impostor = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, _asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_token_allowed(&impostor, &token_address, &true);
}

#[test]
fn test_set_token_allowed_rejected_call_leaves_state_unchanged() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let impostor = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, _asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_token_whitelist_enabled(&emergency_admin, &true);
    client.set_token_allowed(&emergency_admin, &token_address, &true);

    assert!(client.is_token_allowed(&token_address));

    let result = client.try_set_token_allowed(&impostor, &token_address, &false);

    assert!(result.is_err());
    assert!(client.is_token_allowed(&token_address));
}

#[test]
fn test_set_admin_paused_blocks_only_target_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin_a = Address::generate(&env);
    let admin_b = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    asset_client.mint(&admin_a, &1_000);
    asset_client.mint(&admin_b, &1_000);
    client.deposit_funds(&admin_a, &token_address, &1_000);
    client.deposit_funds(&admin_b, &token_address, &1_000);
    client.set_admin_paused(&emergency_admin, &admin_a, &true);

    assert!(client.is_admin_paused(&admin_a));
    assert!(!client.is_admin_paused(&admin_b));
    let event_id_a = test_event_id(&env, 1);
    let result = client.try_create_event(
        &admin_a,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &100,
        &event_id_a);

    assert!(result.is_err());
    let event_id_b = test_event_id(&env, 2);

    client.create_event(
        &admin_b,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &100,
        &event_id_b);
}

#[test]
fn test_token_whitelist_disabled_by_default_allows_any_token() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    assert!(client.is_token_allowed(&token_address));

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    assert_eq!(client.get_balance(&admin), 500);
}

#[test]
fn test_token_whitelist_enabled_blocks_non_allowed_tokens() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let emergency_admin = Address::generate(&env);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_a, _client_a, asset_a) = create_test_token(&env, &token_admin);

    let (token_b, _client_b, asset_b) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);

    client.set_token_whitelist_enabled(&emergency_admin, &true);

    client.set_token_allowed(&emergency_admin, &token_a, &true);

    assert!(client.is_token_allowed(&token_a));

    assert!(!client.is_token_allowed(&token_b));

    asset_a.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_a, &500);

    assert_eq!(client.get_balance(&admin), 500);

    asset_b.mint(&admin, &1_000);

    let result = client.try_deposit_funds(&admin, &token_b, &200);

    assert!(result.is_err());
}
