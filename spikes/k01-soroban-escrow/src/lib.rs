//! K01 (server-build-plan.md) — custom Soroban escrow spike.
//!
//! Scope is deliberately narrow: one escrow, one milestone. The point of this
//! spike is to validate the role model ADR-008 is betting on, not to ship
//! multi-release parity with the old Trustless Work adapter (that's E01,
//! after this spike gates it):
//!
//! 1. The judge can be both `approver` and `release_signer` (same address).
//! 2. The organizer/funder cannot pull funds back out through any path once
//!    funded — only `release` (to the late-bound winner) or a resolver's
//!    `resolve_dispute` can move escrowed funds.
//! 3. The winner address is bound at `release` time, not at `initialize`
//!    time — this is the actual fix for ADR-007's two-hop payout, which
//!    existed only because Trustless Work required winner-shaped roles to be
//!    fixed before the winner was known.
#![cfg_attr(not(test), no_std)]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env};

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Organizer,
    Approver,
    ReleaseSigner,
    Resolver,
    Token,
    Amount,
    Funded,
    Approved,
    Released,
    Disputed,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotFunded = 3,
    AlreadyFunded = 4,
    NotApproved = 5,
    AlreadyApproved = 6,
    AlreadyReleased = 7,
    Disputed = 8,
    NotDisputed = 9,
    InvalidAmount = 10,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Deploy-time setup. `approver` and `release_signer` are intentionally
    /// separate parameters even though the K01 spike passes the same
    /// address for both — the contract itself doesn't assume they're equal,
    /// it just doesn't forbid it. That's the role-model bet.
    pub fn initialize(
        env: Env,
        organizer: Address,
        approver: Address,
        release_signer: Address,
        resolver: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Organizer) {
            return Err(Error::AlreadyInitialized);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        organizer.require_auth();

        let s = env.storage().instance();
        s.set(&DataKey::Organizer, &organizer);
        s.set(&DataKey::Approver, &approver);
        s.set(&DataKey::ReleaseSigner, &release_signer);
        s.set(&DataKey::Resolver, &resolver);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::Amount, &amount);
        s.set(&DataKey::Funded, &false);
        s.set(&DataKey::Approved, &false);
        s.set(&DataKey::Released, &false);
        s.set(&DataKey::Disputed, &false);
        Ok(())
    }

    /// Only the organizer can fund, and only once. There is no
    /// organizer-initiated withdraw function anywhere in this contract —
    /// that's the ADR-003/K01 guarantee enforced structurally, not just by
    /// convention.
    pub fn fund(env: Env) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        let organizer = Self::get_address(&env, &DataKey::Organizer);
        organizer.require_auth();

        if Self::get_bool(&env, &DataKey::Funded) {
            return Err(Error::AlreadyFunded);
        }

        let token_id = Self::get_address(&env, &DataKey::Token);
        let amount = Self::get_amount(&env);
        token::Client::new(&env, &token_id).transfer(
            &organizer,
            &env.current_contract_address(),
            &amount,
        );
        env.storage().instance().set(&DataKey::Funded, &true);
        Ok(())
    }

    pub fn approve(env: Env) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        let approver = Self::get_address(&env, &DataKey::Approver);
        approver.require_auth();

        if !Self::get_bool(&env, &DataKey::Funded) {
            return Err(Error::NotFunded);
        }
        if Self::get_bool(&env, &DataKey::Disputed) {
            return Err(Error::Disputed);
        }
        if Self::get_bool(&env, &DataKey::Approved) {
            return Err(Error::AlreadyApproved);
        }
        env.storage().instance().set(&DataKey::Approved, &true);
        Ok(())
    }

    /// `winner` is passed here, not at `initialize` — this is the late-bound
    /// address ADR-008 exists to enable. Only `release_signer` can call this,
    /// and it can never send funds back to the organizer.
    pub fn release(env: Env, winner: Address) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        let release_signer = Self::get_address(&env, &DataKey::ReleaseSigner);
        release_signer.require_auth();

        if !Self::get_bool(&env, &DataKey::Approved) {
            return Err(Error::NotApproved);
        }
        if Self::get_bool(&env, &DataKey::Disputed) {
            return Err(Error::Disputed);
        }
        if Self::get_bool(&env, &DataKey::Released) {
            return Err(Error::AlreadyReleased);
        }

        let token_id = Self::get_address(&env, &DataKey::Token);
        let amount = Self::get_amount(&env);
        token::Client::new(&env, &token_id).transfer(
            &env.current_contract_address(),
            &winner,
            &amount,
        );
        env.storage().instance().set(&DataKey::Released, &true);
        Ok(())
    }

    /// Either the approver (judge) or the organizer can raise a dispute —
    /// spike scope, revisit who's allowed once T01 (dispute flow UI) exists.
    /// Disputing after release is a no-op error: funds already moved.
    pub fn dispute(env: Env, raised_by: Address) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        raised_by.require_auth();
        let organizer = Self::get_address(&env, &DataKey::Organizer);
        let approver = Self::get_address(&env, &DataKey::Approver);
        if raised_by != organizer && raised_by != approver {
            return Err(Error::NotFunded); // reuse: not a party to this escrow
        }
        if Self::get_bool(&env, &DataKey::Released) {
            return Err(Error::AlreadyReleased);
        }
        env.storage().instance().set(&DataKey::Disputed, &true);
        Ok(())
    }

    /// Only the resolver can settle a dispute, sending the full amount to
    /// either the organizer (refund) or a winner address it names — same
    /// late-bound-address principle as `release`.
    pub fn resolve_dispute(
        env: Env,
        refund_to_organizer: bool,
        winner: Option<Address>,
    ) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        let resolver = Self::get_address(&env, &DataKey::Resolver);
        resolver.require_auth();

        if !Self::get_bool(&env, &DataKey::Disputed) {
            return Err(Error::NotDisputed);
        }

        let token_id = Self::get_address(&env, &DataKey::Token);
        let amount = Self::get_amount(&env);
        let client = token::Client::new(&env, &token_id);
        let contract_address = env.current_contract_address();

        if refund_to_organizer {
            let organizer = Self::get_address(&env, &DataKey::Organizer);
            client.transfer(&contract_address, &organizer, &amount);
        } else {
            let winner = winner.ok_or(Error::InvalidAmount)?;
            client.transfer(&contract_address, &winner, &amount);
        }

        let s = env.storage().instance();
        s.set(&DataKey::Disputed, &false);
        s.set(&DataKey::Released, &true);
        Ok(())
    }

    // --- read-only helpers, useful for the driver script/tests ---

    pub fn is_funded(env: Env) -> bool {
        Self::get_bool(&env, &DataKey::Funded)
    }

    pub fn is_approved(env: Env) -> bool {
        Self::get_bool(&env, &DataKey::Approved)
    }

    pub fn is_released(env: Env) -> bool {
        Self::get_bool(&env, &DataKey::Released)
    }

    pub fn is_disputed(env: Env) -> bool {
        Self::get_bool(&env, &DataKey::Disputed)
    }

    fn require_initialized(env: &Env) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Organizer) {
            return Err(Error::NotInitialized);
        }
        Ok(())
    }

    fn get_address(env: &Env, key: &DataKey) -> Address {
        env.storage().instance().get(key).unwrap()
    }

    fn get_bool(env: &Env, key: &DataKey) -> bool {
        env.storage().instance().get(key).unwrap()
    }

    fn get_amount(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::Amount).unwrap()
    }
}

mod test;
