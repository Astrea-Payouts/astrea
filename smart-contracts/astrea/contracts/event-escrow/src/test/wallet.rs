//! Tests for `wallet.rs`: deposit_funds, withdraw_funds, get_balance,
//! has_wallet.

use super::common::*;
use crate::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn test_deposit_funds_increases_balance() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &500);

    assert_eq!(client.get_balance(&admin), 500);

    client.deposit_funds(&admin, &token_address, &200);

    assert_eq!(client.get_balance(&admin), 700);
}

#[test]
#[should_panic(expected = "Amount must be greater than zero")]
fn test_deposit_funds_rejects_zero_amount() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, _asset_client) = create_test_token(&env, &token_admin);

    client.deposit_funds(&admin, &token_address, &0);
}

#[test]
#[should_panic(expected = "This admin already has a wallet with a different token")]
fn test_deposit_funds_rejects_different_token() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_a, _client_a, asset_a) = create_test_token(&env, &token_admin);

    let (token_b, _client_b, asset_b) = create_test_token(&env, &token_admin);

    asset_a.mint(&admin, &1_000);

    asset_b.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_a, &100);

    client.deposit_funds(&admin, &token_b, &100);
}

#[test]
fn test_withdraw_funds_reduces_balance_and_transfers() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &600);

    client.withdraw_funds(&admin, &400);

    assert_eq!(client.get_balance(&admin), 200);

    assert_eq!(token_client.balance(&admin), 800);
}

#[test]
#[should_panic(expected = "Insufficient balance in wallet")]
fn test_withdraw_funds_rejects_insufficient_balance() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &100);

    client.withdraw_funds(&admin, &500);
}

#[test]
#[should_panic(expected = "Amount must be greater than zero")]
fn test_withdraw_funds_rejects_negative_amount() {
    // Same fund-creation shape as the create_event reward bug: a negative
    // amount would make `wallet.balance -= amount` INCREASE the balance
    // with nothing withdrawn. See docs/contracts-build-plan.md's L01
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

    client.withdraw_funds(&admin, &-500);
}

#[test]
#[should_panic(expected = "Amount must be greater than zero")]
fn test_withdraw_funds_rejects_zero_amount() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &100);

    client.withdraw_funds(&admin, &0);
}

#[test]
#[should_panic(expected = "Admin has no wallet registered")]
fn test_withdraw_funds_without_prior_wallet() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.withdraw_funds(&admin, &100);
}

#[test]
fn test_get_balance_admin_without_wallet_returns_zero() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    assert_eq!(client.get_balance(&admin), 0);
}

#[test]
fn test_has_wallet_distinguishes_no_wallet_from_zero_balance() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin_without_wallet = Address::generate(&env);
    let admin_with_zero_balance = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    assert!(!client.has_wallet(&admin_without_wallet));
    assert_eq!(client.get_balance(&admin_without_wallet), 0);
    asset_client.mint(&admin_with_zero_balance, &1_000);
    client.deposit_funds(&admin_with_zero_balance, &token_address, &500);
    client.withdraw_funds(&admin_with_zero_balance, &500);
    assert!(client.has_wallet(&admin_with_zero_balance));
    assert_eq!(client.get_balance(&admin_with_zero_balance), 0);
}
