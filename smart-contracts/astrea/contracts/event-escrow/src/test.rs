#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Events as _, Ledger as _};
use soroban_sdk::{Address, Env, Event as _};

/// Creates a test token (Stellar Asset Contract) and returns its client
/// both as a TokenClient (transfers) and with mint permissions.
fn create_test_token<'a>(
    env: &Env,

    admin: &Address,
) -> (
    Address,
    TokenClient<'a>,
    soroban_sdk::token::StellarAssetClient<'a>,
) {
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = token_contract.address();
    let token_client = TokenClient::new(env, &token_address);
    let asset_client = soroban_sdk::token::StellarAssetClient::new(env, &token_address);
    (token_address, token_client, asset_client)
}

/// Test-only helper: builds a distinguishable BytesN<16> id for use in tests,
/// simulating a UUID generated off-chain by the backend.
fn test_event_id(env: &Env, n: u8) -> BytesN<16> {
    let mut bytes = [0u8; 16];

    bytes[15] = n;

    BytesN::from_array(env, &bytes)
}

/// Test-only helper: directly overwrites an event's state in storage.
/// Needed to reach states that would otherwise require a full flow
/// (e.g. jumping straight to Ended without a real release_reward call).
fn force_event_state(env: &Env, contract_id: &Address, event_id: BytesN<16>, state: EventState) {
    env.as_contract(contract_id, || {
        let mut event: Event = env
            .storage()
            .persistent()
            .get(&DataKey::Event(event_id.clone()))
            .unwrap();

        event.state = state;

        env.storage()
            .persistent()
            .set(&DataKey::Event(event_id), &event);
    });
}

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
        &token_address,
        &300,
        &id_1,
    );

    let returned_2 = client.create_event(
        &admin,
        &Address::generate(&env),
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

    client.create_event(&admin, &Address::generate(&env), &token_address, &200, &id);

    client.create_event(&admin, &Address::generate(&env), &token_address, &100, &id);
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

    client.create_event(&admin, &Address::generate(&env), &token_address, &500, &id);
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

    client.create_event(&admin, &Address::generate(&env), &token_address, &-500, &id);
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

    client.create_event(&admin, &Address::generate(&env), &token_address, &0, &id);
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

    client.create_event(&admin, &Address::generate(&env), &token_address, &100, &id);
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

    client.create_event(&admin, &Address::generate(&env), &token_b, &100, &id);
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
        &token_address,
        &200,
        &id_1,
    );

    client.create_event(
        &admin,
        &Address::generate(&env),
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
        &token_address,
        &100,
        &id_1,
    );

    client.create_event(
        &admin_2,
        &Address::generate(&env),
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

    client.create_event(&admin, &judge, &token_address, &300, &event_id);

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

    client.create_event(&admin, &judge, &token_address, &300, &event_id);

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
fn test_release_compensation_pays_participants_from_admin_wallet() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    let participant_1 = Address::generate(&env);

    let participant_2 = Address::generate(&env);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &500,
        &event_id,
    );

    client.set_event_cancelled(&admin, &event_id);

    assert_eq!(client.get_balance(&admin), 1_000);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant_1.clone(),

            amount_compensation: 300,
        },
        Participants {
            address: participant_2.clone(),

            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);

    assert_eq!(token_client.balance(&participant_1), 300);

    assert_eq!(token_client.balance(&participant_2), 200);

    assert_eq!(client.get_balance(&admin), 500);
}

#[test]
fn test_release_compensation_allows_amount_different_from_original_reward() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    let participant = Address::generate(&env);

    asset_client.mint(&admin, &2_000);

    client.deposit_funds(&admin, &token_address, &2_000);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &300,
        &event_id,
    );

    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant.clone(),

            amount_compensation: 700,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);

    assert_eq!(token_client.balance(&participant), 700);

    assert_eq!(client.get_balance(&admin), 2_000 - 700);
}

#[test]
#[should_panic(expected = "Event is not cancelled")]
fn test_release_compensation_rejects_event_not_cancelled() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &500,
        &event_id,
    );

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Only admin can release the compensation")]
fn test_release_compensation_rejects_wrong_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let impostor_admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &500,
        &event_id,
    );
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&impostor_admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "No participants provided")]
fn test_release_compensation_rejects_empty_participants() {
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
        &token_address,
        &500,
        &event_id,
    );
    client.set_event_cancelled(&admin, &event_id);
    let participants: Vec<Participants> = soroban_sdk::vec![&env];
    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Compensation must be greater than zero")]
fn test_release_compensation_rejects_zero_amount_participant() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &500,
        &event_id,
    );
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 0,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Compensation must be greater than zero")]
fn test_release_compensation_rejects_negative_amount_participant() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant_ok = Address::generate(&env);
    let participant_bad = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &500,
        &event_id,
    );
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant_ok,
            amount_compensation: 300,
        },
        Participants {
            address: participant_bad,
            amount_compensation: -50,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Insufficient wallet balance to cover compensation")]
fn test_release_compensation_rejects_total_over_wallet_balance() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &500);
    client.deposit_funds(&admin, &token_address, &500);
    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &300,
        &event_id,
    );
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 600,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_release_compensation_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let participant = Address::generate(&env);
    let event_id = test_event_id(&env, 99);
    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Event is not cancelled")]
fn test_release_compensation_rejects_double_release() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &500,
        &event_id,
    );
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
fn test_release_reward_distributes_to_winners_and_ends_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);
    let first_place = Address::generate(&env);
    let second_place = Address::generate(&env);
    let third_place = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &600, &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

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
        Winner {
            place: 3,
            amount: 100,
            address: third_place.clone()
        },
    ];

    client.release_reward(&judge, &event_id, &winners);

    assert_eq!(token_client.balance(&first_place), 300);
    assert_eq!(token_client.balance(&second_place), 200);
    assert_eq!(token_client.balance(&third_place), 100);
}

#[test]
#[should_panic(expected = "Winner amount must be greater than zero")]
fn test_release_reward_rejects_zero_amount_winner() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &500, &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 0,
            address: winner_address
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Winner amount must be greater than zero")]
fn test_release_reward_rejects_negative_amount_winner_even_if_sum_matches() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_ok = Address::generate(&env);
    let winner_bad = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &500, &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 600,
            address: winner_ok
        },
        Winner {
            place: 2,
            amount: -100,
            address: winner_bad
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Too many winners in a single release")]
fn test_release_reward_rejects_too_many_winners() {
    // K06 (spikes/k06-multi-release-budget) validated 25 winners as safe
    // within Stellar Mainnet's instruction budget; this proves the
    // contract enforces that bound on-chain rather than trusting the
    // off-chain caller not to exceed it.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &500, &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let mut winners: Vec<Winner> = Vec::new(&env);
    for i in 0..26u32 {
        winners.push_back(Winner {
            place: i + 1,
            amount: 1,
            address: Address::generate(&env),
        });
    }

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Only the event's judge can release rewards")]
fn test_release_reward_rejects_non_owner_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let impostor_judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &500, &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 500,

            address: winner_address
        },
    ];

    client.release_reward(&impostor_judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Only the event's judge can release rewards")]
fn test_release_reward_rejects_the_organizer_itself() {
    // ADR-003: the organizer is never in the payout path. Creating and
    // funding an event does not grant the organizer any ability to release
    // its reward — only the separately-designated judge can.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &500, &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 500,

            address: winner_address
        },
    ];

    client.release_reward(&admin, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event is not ready to release rewards")]
fn test_release_reward_rejects_event_not_in_progress() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &500, &event_id);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 500,

            address: winner_address
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event is not ready to release rewards")]
fn test_release_reward_rejects_double_release() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &500, &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 500,

            address: winner_address
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_release_reward_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let winner_address = Address::generate(&env);
    let event_id = test_event_id(&env, 99);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 100,

            address: winner_address
        },
    ];

    client.release_reward(&admin, &event_id, &winners);
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
#[should_panic(expected = "Distributed amount does not match the locked reward")]
fn test_release_reward_rejects_mismatched_total() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &500, &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 300,

            address: winner_address
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
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

        client.create_event(&admin, &Address::generate(&env), &token_address, &100, &id);

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
        &token_address,
        &100,
        &event_id,
    );

    assert!(result.is_err());
    client.set_paused(&emergency_admin, &false);
    assert!(!client.is_paused());
    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &100,
        &event_id,
    );
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
        &token_address,
        &100,
        &event_id_a,
    );

    assert!(result.is_err());
    let event_id_b = test_event_id(&env, 2);

    client.create_event(
        &admin_b,
        &Address::generate(&env),
        &token_address,
        &100,
        &event_id_b,
    );
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
fn test_compensation_released_event_is_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &token_address,
        &300,
        &event_id,
    );
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [CompensationReleased {
            event_id: event_id.clone(),
            admin: admin.clone(),
            total: 200,
        }
        .to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_reward_released_event_is_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);
    client.create_event(&admin, &judge, &token_address, &300, &event_id);
    client.set_event_in_progress(&admin, &event_id);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 300,
            address: winner,
        },
    ];

    client.release_reward(&judge, &event_id, &winners);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [RewardReleased {
            event_id: event_id.clone(),
            admin: admin.clone(),
            total_distributed: 300,
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
