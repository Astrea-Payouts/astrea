//! Tests for E01b: `lifecycle::emergency_withdraw` (the two-signature
//! pre-launch withdraw) and the `resolver` field / default-resolver
//! plumbing in `create_event`.

use super::common::*;
use crate::*;
use soroban_sdk::testutils::{Address as _, Events as _};
use soroban_sdk::{Address, Env, Event as _, IntoVal};

#[test]
fn test_emergency_withdraw_fails_with_admin_signature_only() {
    // Neither party alone can authorize the withdraw (ADR-003). Using
    // try_ + is_err() here (not #[should_panic] with a string) since a
    // missing require_auth() surfaces as a host auth error, not one of
    // our own panic messages.
    let env = Env::default();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    env.mock_all_auths();
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

    // From here on, only mock admin's auth — resolver's require_auth()
    // must fail because it was never authorized.
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &admin,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "emergency_withdraw",
            args: (admin.clone(), resolver.clone(), event_id.clone(), 200i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_emergency_withdraw(&admin, &resolver, &event_id, &200);
    assert!(result.is_err());

    // State must be unchanged: the failed call must not have moved funds.
    assert_eq!(client.get_event(&event_id).reward, 500);
    assert_eq!(client.get_balance(&admin), 500);
}

#[test]
fn test_emergency_withdraw_fails_with_resolver_signature_only() {
    let env = Env::default();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    env.mock_all_auths();
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

    // Only mock the resolver's auth this time — admin's require_auth()
    // must fail.
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &resolver,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "emergency_withdraw",
            args: (admin.clone(), resolver.clone(), event_id.clone(), 200i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_emergency_withdraw(&admin, &resolver, &event_id, &200);
    assert!(result.is_err());

    assert_eq!(client.get_event(&event_id).reward, 500);
    assert_eq!(client.get_balance(&admin), 500);
}

#[test]
fn test_emergency_withdraw_succeeds_with_both_signatures() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
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

    assert_eq!(client.get_balance(&admin), 500);

    client.emergency_withdraw(&admin, &resolver, &event_id, &200);

    // The reward reserved on the event shrinks...
    assert_eq!(client.get_event(&event_id).reward, 300);
    // ...and the withdrawn amount lands back in the organizer's wallet
    // balance (not a direct token transfer out — matches
    // set_event_cancelled/expire_event's existing pattern).
    assert_eq!(client.get_balance(&admin), 700);
}

#[test]
fn test_emergency_withdraw_allows_full_reward_leaving_zero() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
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

    client.emergency_withdraw(&admin, &resolver, &event_id, &500);

    assert_eq!(client.get_event(&event_id).reward, 0);
    assert_eq!(client.get_balance(&admin), 1_000);
}

#[test]
#[should_panic(expected = "Emergency withdraw is only allowed before the event starts")]
fn test_emergency_withdraw_fails_once_in_progress() {
    // ADR-006: once InProgress, there is deliberately no unwind path at
    // all until the resolver-adjudicated dispute mechanism (#22) exists.
    // This must reuse the exact same pre-launch gate as
    // set_event_cancelled — never a looser or different check.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
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

    client.set_event_in_progress(&admin, &event_id);

    client.emergency_withdraw(&admin, &resolver, &event_id, &200);
}

#[test]
fn test_emergency_withdraw_succeeds_from_waiting_for_start_state() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
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

    client.set_event_waiting_for_start(&admin, &event_id);

    client.emergency_withdraw(&admin, &resolver, &event_id, &200);

    assert_eq!(client.get_event(&event_id).reward, 300);
}

#[test]
#[should_panic(expected = "Only the event's admin can request an emergency withdraw")]
fn test_emergency_withdraw_rejects_admin_from_a_different_event() {
    // The event's own admin/resolver must be checked against the callers,
    // not just "some admin"/"some resolver" registered anywhere in the
    // system — otherwise one event's resolver could authorize a withdraw
    // on a different event it has nothing to do with.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let real_admin = Address::generate(&env);
    let impostor_admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&real_admin, &1_000);
    asset_client.mint(&impostor_admin, &1_000);
    client.deposit_funds(&real_admin, &token_address, &1_000);
    client.deposit_funds(&impostor_admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &real_admin,
        &judge,
        &Some(resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    client.emergency_withdraw(&impostor_admin, &resolver, &event_id, &200);
}

#[test]
#[should_panic(expected = "Only the event's resolver can approve an emergency withdraw")]
fn test_emergency_withdraw_rejects_resolver_from_a_different_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let real_resolver = Address::generate(&env);
    let impostor_resolver = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(real_resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    client.emergency_withdraw(&admin, &impostor_resolver, &event_id, &200);
}

#[test]
#[should_panic(expected = "Amount exceeds the event's reserved reward")]
fn test_emergency_withdraw_rejects_amount_over_reward() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
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

    client.emergency_withdraw(&admin, &resolver, &event_id, &600);
}

#[test]
#[should_panic(expected = "Amount must be greater than zero")]
fn test_emergency_withdraw_rejects_zero_amount() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
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

    client.emergency_withdraw(&admin, &resolver, &event_id, &0);
}

#[test]
#[should_panic(expected = "Amount must be greater than zero")]
fn test_emergency_withdraw_rejects_negative_amount() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
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

    client.emergency_withdraw(&admin, &resolver, &event_id, &-100);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_emergency_withdraw_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let event_id = test_event_id(&env, 99);

    client.emergency_withdraw(&admin, &resolver, &event_id, &100);
}

#[test]
fn test_emergency_withdrawal_event_is_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let resolver = Address::generate(&env);
    let judge = Address::generate(&env);
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

    client.emergency_withdraw(&admin, &resolver, &event_id, &200);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [EmergencyWithdrawal {
            event_id: event_id.clone(),
            admin: admin.clone(),
            resolver: resolver.clone(),
            amount: 200,
        }
        .to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_create_event_uses_default_resolver_when_none_given() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let default_resolver = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    client.initialize_default_resolver(&emergency_admin, &default_resolver);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);

    // No resolver named explicitly — falls back to the default.
    client.create_event(&admin, &judge, &None, &token_address, &500, &event_id);

    // Prove the default actually took effect: an emergency_withdraw
    // signed by the default resolver (not any random address) succeeds.
    client.emergency_withdraw(&admin, &default_resolver, &event_id, &100);
    assert_eq!(client.get_event(&event_id).reward, 400);
}

#[test]
fn test_create_event_uses_explicit_resolver_over_default() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let default_resolver = Address::generate(&env);
    let named_resolver = Address::generate(&env);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    client.initialize_emergency_admin(&emergency_admin);
    client.initialize_default_resolver(&emergency_admin, &default_resolver);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &judge,
        &Some(named_resolver.clone()),
        &token_address,
        &500,
        &event_id,
    );

    // The default resolver has no authority here — only the named one.
    let result = client.try_emergency_withdraw(&admin, &default_resolver, &event_id, &100);
    assert!(result.is_err());

    client.emergency_withdraw(&admin, &named_resolver, &event_id, &100);
    assert_eq!(client.get_event(&event_id).reward, 400);
}

#[test]
#[should_panic(expected = "Default resolver not initialized")]
fn test_create_event_without_resolver_panics_if_default_not_configured() {
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

    client.create_event(&admin, &judge, &None, &token_address, &500, &event_id);
}

#[test]
#[should_panic(expected = "Default resolver already initialized")]
fn test_initialize_default_resolver_rejects_double_call() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let resolver_1 = Address::generate(&env);
    let resolver_2 = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.initialize_default_resolver(&emergency_admin, &resolver_1);
    client.initialize_default_resolver(&emergency_admin, &resolver_2);
}

#[test]
#[should_panic(expected = "Only the emergency admin can perform this action")]
fn test_initialize_default_resolver_rejects_non_emergency_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let emergency_admin = Address::generate(&env);
    let impostor = Address::generate(&env);
    let resolver = Address::generate(&env);

    client.initialize_emergency_admin(&emergency_admin);
    client.initialize_default_resolver(&impostor, &resolver);
}
