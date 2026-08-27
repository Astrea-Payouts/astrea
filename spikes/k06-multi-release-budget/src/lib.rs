//! K06 (build-plan.md) — spike answering one question the Council raised on
//! the multi-milestone/category-winner contract redesign:
//!
//! Can `close_event()` pay out N winners (one token transfer each) in a
//! single contract invocation without exceeding Stellar Mainnet's per-
//! invocation resource limits? This does not model the full contract (no
//! `AdminWallet`, no `DataKey::Event`, no state machine) — it isolates just
//! the thing in question: N `token::Client::transfer` calls in one function.
#![cfg_attr(not(test), no_std)]

use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};

#[contract]
pub struct MultiReleaseSpike;

#[contractimpl]
impl MultiReleaseSpike {
    /// Pays `amounts[i]` of `token` to `winners[i]` for every i, all in one
    /// invocation — the shape `close_event()` would need for category
    /// winners instead of a single reward.
    pub fn close_event(env: Env, token: Address, winners: Vec<Address>, amounts: Vec<i128>) {
        let contract_address = env.current_contract_address();
        let client = token::Client::new(&env, &token);
        for i in 0..winners.len() {
            client.transfer(&contract_address, &winners.get(i).unwrap(), &amounts.get(i).unwrap());
        }
    }
}

mod test;
