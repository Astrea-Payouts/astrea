//! Tests for the go-live fee: the `Treasury`/`FeeBps` governance
//! singletons (`initialize_treasury`, `get_treasury`, `set_fee_bps`,
//! `get_fee_bps`) and the fee-charging logic added to
//! `lifecycle::set_event_in_progress`, plus `quote_go_live_fee`.

use super::common::*;
use crate::*;
use soroban_sdk::testutils::{Address as _, Events as _};
use soroban_sdk::{Address, Env, Event as _};

#[test]
fn test_default_fee_bps_is_50_when_nothing_was_set() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);

    assert_eq!(client.get_fee_bps(), 50);
}

#[test]
fn test_go_live_charges_exact_floor_amount_and_emits_fee_charged() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    let treasury = init_treasury(&env, &client, &emergency_admin);

    // Reward 1_000 at the default 50bps floors to a clean 5.
    asset_client.mint(&admin, &1_010);
    client.deposit_funds(&admin, &token_address, &1_010);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &1_000,
        &event_id,
    );

    // create_event reserved the 1_000 reward; 10 is left as free balance.
    assert_eq!(client.get_balance(&admin), 10);

    client.set_event_in_progress(&admin, &event_id, &(env.ledger().timestamp() + 1_000));

    // Events accumulate per top-level invocation, so this must run before
    // any other client call clears the buffer for the next one.
    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [
            EventStarted {
                event_id: event_id.clone(),
                admin: admin.clone(),
            }
            .to_xdr(&env, &contract_id),
            FeeCharged {
                event_id: event_id.clone(),
                admin: admin.clone(),
                treasury: treasury.clone(),
                fee: 5,
            }
            .to_xdr(&env, &contract_id),
        ],
    );

    // Fee moved from the organizer's free balance to the treasury...
    assert_eq!(client.get_balance(&admin), 5);
    assert_eq!(token_client.balance(&treasury), 5);
    // ...and the event's reserved reward is untouched by the fee.
    assert_eq!(client.get_event(&event_id).reward, 1_000);
}

#[test]
fn test_release_reward_pays_exactly_reward_after_charged_go_live() {
    // The fee comes from free balance, never from the reserve: proves
    // release_reward still pays exactly `reward`, not `reward - fee`.
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    init_treasury(&env, &client, &emergency_admin);

    asset_client.mint(&admin, &1_010);
    client.deposit_funds(&admin, &token_address, &1_010);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &1_000,
        &event_id,
    );

    client.set_event_in_progress(&admin, &event_id, &(env.ledger().timestamp() + 1_000));

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 1_000,
            address: winner.clone(),
        },
    ];

    client.release_reward(&judge, &event_id, &winners);

    assert_eq!(token_client.balance(&winner), 1_000);
}

#[test]
#[should_panic(expected = "Insufficient balance to cover the go-live fee")]
fn test_go_live_rejects_insufficient_free_balance_and_leaves_state_unchanged() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    init_treasury(&env, &client, &emergency_admin);

    // Deposit exactly the reward: zero free balance left, but the fee
    // (5 at the default 50bps on 1_000) is still owed.
    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &1_000,
        &event_id,
    );

    let result =
        client.try_set_event_in_progress(&admin, &event_id, &(env.ledger().timestamp() + 1_000));
    assert!(result.is_err());

    // The balance check must precede the state change.
    assert_eq!(client.get_event(&event_id).state, EventState::Created);

    // Re-run the same call directly so #[should_panic] catches the message
    // (try_* returns a Result instead of panicking).
    client.set_event_in_progress(&admin, &event_id, &(env.ledger().timestamp() + 1_000));
}

#[test]
fn test_go_live_fee_flooring_to_zero_charges_nothing() {
    // A reward small enough to floor to zero at 50bps pays nothing — this
    // is the documented behavior, not a special case, and it must succeed
    // even with no treasury configured at all (fee == 0 means the "fail
    // closed on unset treasury" rule never triggers).
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &10);
    client.deposit_funds(&admin, &token_address, &10);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &1,
        &event_id,
    );

    client.set_event_in_progress(&admin, &event_id, &(env.ledger().timestamp() + 1_000));

    // Only EventStarted — no FeeCharged, since fee == 0. Must run before
    // any other client call clears the per-invocation event buffer.
    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [EventStarted {
            event_id: event_id.clone(),
            admin: admin.clone(),
        }
        .to_xdr(&env, &contract_id)],
    );

    // Nothing moved: free balance is exactly what create_event left.
    assert_eq!(client.get_balance(&admin), 9);
}

#[test]
#[should_panic(expected = "Treasury not initialized")]
fn test_go_live_rejects_nonzero_fee_with_unset_treasury() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    // No initialize_treasury call — default fee is 50bps, nonzero on this
    // reward, so this must fail closed rather than silently charge zero.
    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id,
    );

    client.set_event_in_progress(&admin, &event_id, &(env.ledger().timestamp() + 1_000));
}

#[test]
fn test_go_live_succeeds_with_unset_treasury_when_fee_is_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    // Fee explicitly set to zero, treasury deliberately left unset.
    client.set_fee_bps(&emergency_admin, &0);

    asset_client.mint(&admin, &500);
    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id,
    );

    client.set_event_in_progress(&admin, &event_id, &(env.ledger().timestamp() + 1_000));

    assert_eq!(client.get_event(&event_id).state, EventState::InProgress);
}

#[test]
#[should_panic(expected = "Fee exceeds the maximum allowed")]
fn test_set_fee_bps_rejects_above_ceiling() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_fee_bps(&emergency_admin, &501);
}

#[test]
fn test_set_fee_bps_accepts_exact_ceiling() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_fee_bps(&emergency_admin, &500);

    assert_eq!(client.get_fee_bps(), 500);
}

#[test]
#[should_panic(expected = "Only the emergency admin can perform this action")]
fn test_set_fee_bps_rejects_non_emergency_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let impostor = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.set_fee_bps(&impostor, &100);
}

#[test]
#[should_panic(expected = "Treasury already initialized")]
fn test_initialize_treasury_rejects_double_call() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let treasury_1 = Address::generate(&env);
    let treasury_2 = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.initialize_treasury(&emergency_admin, &treasury_1);
    client.initialize_treasury(&emergency_admin, &treasury_2);
}

#[test]
#[should_panic(expected = "Only the emergency admin can perform this action")]
fn test_initialize_treasury_rejects_non_emergency_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let impostor = Address::generate(&env);
    let treasury = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.initialize_treasury(&impostor, &treasury);
}

#[test]
fn test_quote_go_live_fee_equals_amount_actually_charged() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    let treasury = init_treasury(&env, &client, &emergency_admin);

    asset_client.mint(&admin, &1_010);
    client.deposit_funds(&admin, &token_address, &1_010);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &1_000,
        &event_id,
    );

    let quoted = client.quote_go_live_fee(&event_id);

    client.set_event_in_progress(&admin, &event_id, &(env.ledger().timestamp() + 1_000));

    assert_eq!(token_client.balance(&treasury), quoted);
    assert_eq!(quoted, 5);
}

#[test]
fn test_cancel_before_go_live_refunds_full_reward_and_charges_nothing() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    let treasury = init_treasury(&env, &client, &emergency_admin);

    asset_client.mint(&admin, &1_010);
    client.deposit_funds(&admin, &token_address, &1_010);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &1_000,
        &event_id,
    );

    client.set_event_cancelled(&admin, &event_id);

    // Full deposit back, nothing charged, nothing moved to the treasury.
    assert_eq!(client.get_balance(&admin), 1_010);
    assert_eq!(token_client.balance(&treasury), 0);
}
