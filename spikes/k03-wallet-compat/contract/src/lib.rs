//! K03 — wallet compatibility check. Deliberately trivial: the only thing
//! this contract does is require_auth() on whatever address calls it. The
//! point isn't to test escrow logic (K01 already did that) — it's to
//! isolate one question: can a given wallet extension actually produce a
//! signature Stellar Wallets Kit hands off correctly, for a Soroban
//! InvokeHostFunction transaction, that the ledger accepts?
#![cfg_attr(not(test), no_std)]

use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct PingContract;

#[contractimpl]
impl PingContract {
    pub fn ping(_env: Env, caller: Address) -> bool {
        caller.require_auth();
        true
    }
}
