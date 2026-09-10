#![no_std]
// create_event_with_deadline (and the internal helper feeding it) genuinely
// need 8 params — they're a Soroban contract entry point, so every field is
// independently supplied by the caller; a params struct wouldn't shrink
// this meaningfully. Scoped no narrower than crate-level on purpose:
// #[contractimpl] generates EventEscrowClient as a separate item that does
// NOT inherit an #[allow] placed on the original impl block (confirmed —
// clippy still flagged the generated client with the allow on the impl),
// so a per-function or per-impl allow cannot reach the macro-generated
// code. This is the narrowest scope that actually works.
#![allow(clippy::too_many_arguments)]

//! `EventEscrow` — Astrea's escrow contract entry point.
//!
//! This file is deliberately thin: it only declares the sibling modules
//! and wires the wasm-exported `#[contractimpl]` surface to them, one
//! line per function. The actual logic lives in:
//! - `types` — the on-chain data model (`Event`, `AdminWallet`, ...)
//! - `events` — the `#[contractevent]` notifications the contract emits
//! - `access` — shared guards (pause, emergency-admin, token whitelist)
//! - `wallet` — per-organizer free balance (deposit/withdraw)
//! - `lifecycle` — the event state machine, including `emergency_withdraw`
//! - `rewards` — the two ways a reward actually leaves the contract
//! - `governance` — the emergency-admin controlled knobs
//!
//! See docs/contracts-build-plan.md and docs/architecture.md (ADR-002,
//! ADR-003, ADR-006) for the product/design reasoning behind this shape.

mod access;
mod events;
mod governance;
mod lifecycle;
mod rewards;
mod types;
mod wallet;

pub use events::*;
pub use types::*;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Vec};

// EventEscrow is a single shared contract (ADR-006). This impl block is a
// thin wiring layer only — the real logic lives in wallet.rs, lifecycle.rs,
// rewards.rs and governance.rs.
#[contract]
pub struct EventEscrow;

#[contractimpl]
impl EventEscrow {
    pub fn deposit_funds(env: Env, admin: Address, token: Address, amount: i128) {
        wallet::deposit_funds(env, admin, token, amount)
    }

    pub fn withdraw_funds(env: Env, admin: Address, amount: i128) {
        wallet::withdraw_funds(env, admin, amount)
    }

    pub fn get_balance(env: Env, admin: Address) -> i128 {
        wallet::get_balance(env, admin)
    }

    pub fn has_wallet(env: Env, admin: Address) -> bool {
        wallet::has_wallet(env, admin)
    }

    pub fn create_event(
        env: Env,
        admin: Address,
        judge: Address,
        resolver: Option<Address>,
        token: Address,
        reward: i128,
        event_id: BytesN<16>,
    ) -> BytesN<16> {
        lifecycle::create_event(env, admin, judge, resolver, token, reward, event_id)
    }

    pub fn create_event_with_deadline(
        env: Env,
        admin: Address,
        judge: Address,
        resolver: Option<Address>,
        token: Address,
        reward: i128,
        event_id: BytesN<16>,
        deadline: u64,
    ) -> BytesN<16> {
        lifecycle::create_event_with_deadline(
            env, admin, judge, resolver, token, reward, event_id, deadline,
        )
    }

    pub fn expire_event(env: Env, event_id: BytesN<16>) {
        lifecycle::expire_event(env, event_id)
    }

    pub fn set_event_waiting_for_start(env: Env, admin: Address, event_id: BytesN<16>) {
        lifecycle::set_event_waiting_for_start(env, admin, event_id)
    }

    pub fn set_event_in_progress(env: Env, admin: Address, event_id: BytesN<16>) {
        lifecycle::set_event_in_progress(env, admin, event_id)
    }

    pub fn set_event_cancelled(env: Env, admin: Address, event_id: BytesN<16>) {
        lifecycle::set_event_cancelled(env, admin, event_id)
    }

    pub fn emergency_withdraw(
        env: Env,
        admin: Address,
        resolver: Address,
        event_id: BytesN<16>,
        amount: i128,
    ) {
        lifecycle::emergency_withdraw(env, admin, resolver, event_id, amount)
    }

    pub fn release_compensation(
        env: Env,
        admin: Address,
        event_id: BytesN<16>,
        participants: Vec<Participants>,
    ) {
        rewards::release_compensation(env, admin, event_id, participants)
    }

    pub fn release_reward(env: Env, judge: Address, event_id: BytesN<16>, winners: Vec<Winner>) {
        rewards::release_reward(env, judge, event_id, winners)
    }

    pub fn get_events_by_admin(env: Env, admin: Address) -> Vec<BytesN<16>> {
        lifecycle::get_events_by_admin(env, admin)
    }

    pub fn get_events_by_admin_page(
        env: Env,
        admin: Address,
        offset: u32,
        limit: u32,
    ) -> Vec<BytesN<16>> {
        lifecycle::get_events_by_admin_page(env, admin, offset, limit)
    }

    pub fn get_events_by_admin_count(env: Env, admin: Address) -> u32 {
        lifecycle::get_events_by_admin_count(env, admin)
    }

    pub fn get_event(env: Env, event_id: BytesN<16>) -> Event {
        lifecycle::get_event(env, event_id)
    }

    pub fn initialize_emergency_admin(env: Env, emergency_admin: Address) {
        governance::initialize_emergency_admin(env, emergency_admin)
    }

    pub fn initialize_default_resolver(env: Env, caller: Address, default_resolver: Address) {
        governance::initialize_default_resolver(env, caller, default_resolver)
    }

    pub fn get_default_resolver(env: Env) -> Address {
        governance::get_default_resolver(env)
    }

    pub fn set_paused(env: Env, caller: Address, paused: bool) {
        governance::set_paused(env, caller, paused)
    }

    pub fn set_admin_paused(env: Env, caller: Address, target_admin: Address, paused: bool) {
        governance::set_admin_paused(env, caller, target_admin, paused)
    }

    pub fn is_paused(env: Env) -> bool {
        governance::is_paused(env)
    }

    pub fn is_admin_paused(env: Env, admin: Address) -> bool {
        governance::is_admin_paused(env, admin)
    }

    pub fn set_token_whitelist_enabled(env: Env, caller: Address, enabled: bool) {
        governance::set_token_whitelist_enabled(env, caller, enabled)
    }

    pub fn set_token_allowed(env: Env, caller: Address, token: Address, allowed: bool) {
        governance::set_token_allowed(env, caller, token, allowed)
    }

    pub fn is_token_allowed(env: Env, token: Address) -> bool {
        governance::is_token_allowed(env, token)
    }
}

mod test;
