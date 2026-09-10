//! Cross-cutting guards and storage bookkeeping shared by every other
//! module: TTL extension, the pause switch, the emergency-admin check,
//! and the token whitelist. Nothing here is part of the contract's public
//! ABI — these are internal helpers only, `pub(crate)` so sibling modules
//! can call them but the outside world never sees them directly.

use crate::types::DataKey;
use soroban_sdk::{Address, Env};

const DAY_IN_LEDGERS: u32 = 17280;
const WALLET_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const WALLET_TTL_EXTEND_TO: u32 = 90 * DAY_IN_LEDGERS;
const EVENT_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const EVENT_TTL_EXTEND_TO: u32 = 90 * DAY_IN_LEDGERS;
const EVENTS_INDEX_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const EVENTS_INDEX_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;
const GOVERNANCE_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const GOVERNANCE_TTL_EXTEND_TO: u32 = 180 * DAY_IN_LEDGERS;

pub(crate) fn bump_wallet_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, WALLET_TTL_THRESHOLD, WALLET_TTL_EXTEND_TO);
}

pub(crate) fn bump_event_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, EVENT_TTL_THRESHOLD, EVENT_TTL_EXTEND_TO);
}

pub(crate) fn bump_events_index_ttl(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(
        key,
        EVENTS_INDEX_TTL_THRESHOLD,
        EVENTS_INDEX_TTL_EXTEND_TO,
    );
}

pub(crate) fn bump_governance_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, GOVERNANCE_TTL_THRESHOLD, GOVERNANCE_TTL_EXTEND_TO);
}

pub(crate) fn assert_not_paused(env: &Env, admin: &Address) {
    let globally_paused: bool = env
        .storage()
        .persistent()
        .get(&DataKey::Paused)
        .unwrap_or(false);

    assert!(!globally_paused, "Contract is paused");

    let admin_paused: bool = env
        .storage()
        .persistent()
        .get(&DataKey::AdminPaused(admin.clone()))
        .unwrap_or(false);

    assert!(!admin_paused, "This admin's operations are paused");
}

pub(crate) fn assert_is_emergency_admin(env: &Env, caller: &Address) {
    let emergency_admin: Address = env
        .storage()
        .persistent()
        .get(&DataKey::EmergencyAdmin)
        .expect("Emergency admin not initialized");

    assert_eq!(
        &emergency_admin, caller,
        "Only the emergency admin can perform this action"
    );
}

/// E01b — resolves the resolver to use for a new event: the one the
/// organizer explicitly named, or Astrea's default. Panics if no default
/// has been configured and none was supplied — mirrors the existing
/// `assert_is_emergency_admin` "not initialized" failure shape so a missing
/// governance setup fails loudly instead of silently.
pub(crate) fn get_default_resolver(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&DataKey::DefaultResolver)
        .expect("Default resolver not initialized")
}

/// Token whitelist is **default-deny-disabled**, i.e. any SEP-41 token is
/// accepted unless `set_token_whitelist_enabled(true)` has been called by
/// the emergency admin. This is a deliberate, documented decision for the
/// current testnet/pilot phase, not an oversight: it keeps the contract
/// usable while the token policy is still being decided. Before accepting
/// real (non-testnet) funds, enable the whitelist and populate it with the
/// specific tokens Astrea intends to support (e.g. USDC) — see the Council
/// review referenced in build-plan.md's security pass (L01).
pub(crate) fn is_token_allowed_internal(env: &Env, token: &Address) -> bool {
    let enabled: bool = env
        .storage()
        .persistent()
        .get(&DataKey::TokenWhitelistEnabled)
        .unwrap_or(false);

    if !enabled {
        return true;
    }

    env.storage()
        .persistent()
        .get(&DataKey::AllowedToken(token.clone()))
        .unwrap_or(false)
}

pub(crate) fn assert_token_allowed(env: &Env, token: &Address) {
    assert!(
        is_token_allowed_internal(env, token),
        "Token is not allowed"
    );
}
