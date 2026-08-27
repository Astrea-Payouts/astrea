#![cfg(test)]

use super::{MultiReleaseSpike, MultiReleaseSpikeClient};
use soroban_env_host::InvocationResourceLimits;
use soroban_sdk::{
    testutils::{cost_estimate::NetworkInvocationResourceLimits, Address as _},
    token::StellarAssetClient,
    vec, Address, Env, Vec,
};

fn run(env: &Env, contract: &MultiReleaseSpikeClient, token: &Address, n: u32) {
    let mut winners: Vec<Address> = vec![env];
    let mut amounts: Vec<i128> = vec![env];
    for _ in 0..n {
        winners.push_back(Address::generate(env));
        amounts.push_back(10_0000000i128); // 10 units at 7 decimals, arbitrary
    }
    contract.close_event(token, &winners, &amounts);
}

fn report(n: u32, enforce_mainnet: bool) {
    let env = Env::default();
    env.mock_all_auths();
    if enforce_mainnet {
        env.cost_estimate()
            .enforce_resource_limits(InvocationResourceLimits::mainnet());
    } else {
        env.cost_estimate().disable_resource_limits();
    }

    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token_contract_id.address();
    let token_admin_client = StellarAssetClient::new(&env, &token);

    let contract_id = env.register(MultiReleaseSpike, ());
    let contract = MultiReleaseSpikeClient::new(&env, &contract_id);

    // Fund the contract itself so it has a balance to pay out from.
    token_admin_client.mint(&contract_id, &(10_0000000i128 * n as i128).max(1));

    run(&env, &contract, &token, n);

    let cost = env.cost_estimate();
    let resources = cost.resources();
    let limits = InvocationResourceLimits::mainnet();
    std::println!(
        "n={:>3}  instructions={:>12} / {:<12} ({:>5.1}%)   mem_bytes={:>10} / {:<10} ({:>5.1}%)   write_entries={:>3} / {:<3}",
        n,
        resources.instructions,
        limits.instructions,
        100.0 * resources.instructions as f64 / limits.instructions as f64,
        resources.mem_bytes,
        limits.mem_bytes,
        100.0 * resources.mem_bytes as f64 / limits.mem_bytes as f64,
        resources.write_entries,
        limits.write_entries,
    );
}

#[test]
fn budget_report_across_winner_counts() {
    // No assertions here on purpose — this is a spike to print real numbers,
    // not a pass/fail test. `enforce_resource_limits` above still panics
    // this test loudly if any single N blows past Mainnet's limits.
    for n in [1u32, 3, 5, 10, 25] {
        report(n, true);
    }
}

#[test]
fn budget_report_beyond_mainnet_limits_disabled() {
    // Same calls, but with resource-limit enforcement OFF, to see the real
    // instruction/memory numbers at higher N and confirm whether a failure
    // at N=50 (see the enforced test) is a genuine Mainnet-limit problem or
    // an artifact of testutils' own auth-tracking overhead.
    for n in [50u32, 100] {
        report(n, false);
    }
}
