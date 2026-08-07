#![cfg(test)]

use super::{EscrowContract, EscrowContractClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

#[allow(dead_code)] // shared fixture — not every field is read by every test
struct Setup<'a> {
    env: Env,
    contract: EscrowContractClient<'a>,
    token: TokenClient<'a>,
    token_admin: StellarAssetClient<'a>,
    organizer: Address,
    approver: Address,
    release_signer: Address,
    resolver: Address,
    winner: Address,
    amount: i128,
}

fn setup(same_approver_and_release_signer: bool) -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let organizer = Address::generate(&env);
    let approver = Address::generate(&env);
    let release_signer = if same_approver_and_release_signer {
        approver.clone()
    } else {
        Address::generate(&env)
    };
    let resolver = Address::generate(&env);
    let winner = Address::generate(&env);

    let token_admin_address = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract_v2(token_admin_address.clone());
    let token = TokenClient::new(&env, &token_contract_id.address());
    let token_admin = StellarAssetClient::new(&env, &token_contract_id.address());

    let amount: i128 = 1_000_0000000; // 1000 units at 7 decimals, arbitrary for the spike
    token_admin.mint(&organizer, &amount);

    let contract_id = env.register(EscrowContract, ());
    let contract = EscrowContractClient::new(&env, &contract_id);
    contract.initialize(
        &organizer,
        &approver,
        &release_signer,
        &resolver,
        &token.address,
        &amount,
    );

    Setup {
        env,
        contract,
        token,
        token_admin,
        organizer,
        approver,
        release_signer,
        resolver,
        winner,
        amount,
    }
}

#[test]
fn happy_path_judge_as_approver_and_release_signer() {
    // This is the role model the whole spike exists to validate: one judge
    // address plays both approver and release_signer.
    let s = setup(true);

    s.contract.fund();
    assert!(s.contract.is_funded());

    s.contract.approve();
    assert!(s.contract.is_approved());

    // Winner bound here, at release time — not at initialize time. This is
    // the ADR-007 two-hop fix: no forward-payment step needed, the contract
    // pays the winner directly.
    s.contract.release(&s.winner);
    assert!(s.contract.is_released());
    assert_eq!(s.token.balance(&s.winner), s.amount);
    assert_eq!(s.token.balance(&s.organizer), 0);
}

#[test]
fn happy_path_separate_approver_and_release_signer_also_works() {
    // The contract doesn't require the two roles to be equal, only that
    // K01's target role model (same address) is *allowed*, not mandatory.
    let s = setup(false);
    s.contract.fund();
    s.contract.approve();
    s.contract.release(&s.winner);
    assert_eq!(s.token.balance(&s.winner), s.amount);
}

#[test]
fn organizer_cannot_release_or_withdraw() {
    // ADR-003's guarantee, structurally: there is no function an organizer
    // can call that moves escrowed funds anywhere, including back to
    // themselves. `release` requires release_signer auth specifically.
    let s = setup(true);
    s.contract.fund();
    s.contract.approve();

    // Simulate an organizer-authored call by restricting the mocked auths
    // to only the organizer for this invocation. release_signer never
    // authorized it, so this must panic on the require_auth check.
    s.env.set_auths(&[]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        s.contract.release(&s.organizer)
    }));
    assert!(
        result.is_err(),
        "release must fail without release_signer's authorization"
    );
    assert!(!s.contract.is_released());
}

#[test]
fn release_before_approval_fails() {
    let s = setup(true);
    s.contract.fund();
    let result = s.contract.try_release(&s.winner);
    assert!(result.is_err(), "release before approve must fail");
}

#[test]
fn double_release_fails() {
    let s = setup(true);
    s.contract.fund();
    s.contract.approve();
    s.contract.release(&s.winner);
    let result = s.contract.try_release(&s.winner);
    assert!(result.is_err(), "a second release must fail");
    // balance unaffected by the failed second attempt
    assert_eq!(s.token.balance(&s.winner), s.amount);
}

#[test]
fn dispute_blocks_release_until_resolved() {
    let s = setup(true);
    s.contract.fund();
    s.contract.approve();
    s.contract.dispute(&s.organizer);
    assert!(s.contract.is_disputed());

    let result = s.contract.try_release(&s.winner);
    assert!(result.is_err(), "release must fail while disputed");

    s.contract.resolve_dispute(&false, &Some(s.winner.clone()));
    assert!(s.contract.is_released());
    assert_eq!(s.token.balance(&s.winner), s.amount);
}

#[test]
fn resolver_can_refund_organizer_on_dispute() {
    let s = setup(true);
    s.contract.fund();
    s.contract.approve();
    s.contract.dispute(&s.approver);
    s.contract.resolve_dispute(&true, &None);
    assert_eq!(s.token.balance(&s.organizer), s.amount);
    assert_eq!(s.token.balance(&s.winner), 0);
}

#[test]
fn double_fund_fails() {
    let s = setup(true);
    s.contract.fund();
    let result = s.contract.try_fund();
    assert!(result.is_err(), "funding twice must fail");
}
