//! Emergency-admin controlled knobs: pausing (global or per-organizer),
//! the token whitelist, and the two governance singletons
//! (`EmergencyAdmin` itself, and E01b's `DefaultResolver`). Nothing here
//! touches an individual event or wallet directly — it only gates whether
//! other modules' functions are allowed to run.

use crate::access::{
    assert_is_emergency_admin, bump_governance_ttl,
    get_default_resolver as default_resolver_internal, get_fee_bps as fee_bps_internal,
    get_treasury as treasury_internal, is_token_allowed_internal,
};
use crate::events::{AdminPaused, ContractPaused};
use crate::types::DataKey;
use soroban_sdk::{Address, Env};

/// Hard on-chain ceiling for `set_fee_bps`. A `const`, not a storage value,
/// so anyone reading the contract source — or its published wasm — can
/// verify Astrea cannot raise the go-live fee past 5% without a redeploy.
pub(crate) const MAX_FEE_BPS: u32 = 500;

/// Go-live fee rate used when the emergency admin hasn't set an explicit
/// one yet (0.5%). Unlike `MAX_FEE_BPS`, this is a starting point, not a
/// limit — `set_fee_bps` can move the effective rate anywhere up to the
/// ceiling.
pub(crate) const DEFAULT_FEE_BPS: u32 = 50;

pub(crate) fn initialize_emergency_admin(env: Env, emergency_admin: Address) {
    emergency_admin.require_auth();

    assert!(
        !env.storage().persistent().has(&DataKey::EmergencyAdmin),
        "Emergency admin already initialized"
    );

    env.storage()
        .persistent()
        .set(&DataKey::EmergencyAdmin, &emergency_admin);

    bump_governance_ttl(&env, &DataKey::EmergencyAdmin);
}

/// E01b — one-time init for Astrea's default resolver address, used by
/// `create_event`/`create_event_with_deadline` whenever the organizer
/// doesn't name a resolver explicitly. Same init-once shape as
/// `initialize_emergency_admin`; must be called before the first
/// `create_event` that relies on the default, or that call panics with
/// "Default resolver not initialized".
pub(crate) fn initialize_default_resolver(env: Env, caller: Address, default_resolver: Address) {
    caller.require_auth();
    assert_is_emergency_admin(&env, &caller);

    assert!(
        !env.storage().persistent().has(&DataKey::DefaultResolver),
        "Default resolver already initialized"
    );

    env.storage()
        .persistent()
        .set(&DataKey::DefaultResolver, &default_resolver);

    bump_governance_ttl(&env, &DataKey::DefaultResolver);
}

pub(crate) fn get_default_resolver(env: Env) -> Address {
    default_resolver_internal(&env)
}

pub(crate) fn set_paused(env: Env, caller: Address, paused: bool) {
    caller.require_auth();
    assert_is_emergency_admin(&env, &caller);
    env.storage().persistent().set(&DataKey::Paused, &paused);
    bump_governance_ttl(&env, &DataKey::Paused);
    ContractPaused { paused }.publish(&env);
}

pub(crate) fn set_admin_paused(env: Env, caller: Address, target_admin: Address, paused: bool) {
    caller.require_auth();
    assert_is_emergency_admin(&env, &caller);
    let key = DataKey::AdminPaused(target_admin.clone());
    env.storage().persistent().set(&key, &paused);
    bump_governance_ttl(&env, &key);

    AdminPaused {
        admin: target_admin,
        paused,
    }
    .publish(&env);
}

pub(crate) fn is_paused(env: Env) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

pub(crate) fn is_admin_paused(env: Env, admin: Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::AdminPaused(admin))
        .unwrap_or(false)
}

pub(crate) fn set_token_whitelist_enabled(env: Env, caller: Address, enabled: bool) {
    caller.require_auth();

    assert_is_emergency_admin(&env, &caller);

    env.storage()
        .persistent()
        .set(&DataKey::TokenWhitelistEnabled, &enabled);

    bump_governance_ttl(&env, &DataKey::TokenWhitelistEnabled);
}

pub(crate) fn set_token_allowed(env: Env, caller: Address, token: Address, allowed: bool) {
    caller.require_auth();
    assert_is_emergency_admin(&env, &caller);
    let key = DataKey::AllowedToken(token);

    env.storage().persistent().set(&key, &allowed);
    bump_governance_ttl(&env, &key);
}

pub(crate) fn is_token_allowed(env: Env, token: Address) -> bool {
    is_token_allowed_internal(&env, &token)
}

/// One-time init for the go-live fee treasury address. Same init-once
/// shape as `initialize_default_resolver`; must be called before the first
/// `set_event_in_progress` that would charge a nonzero fee, or that call
/// panics with "Treasury not initialized" (fail closed — an unset treasury
/// must never silently mean "free").
pub(crate) fn initialize_treasury(env: Env, caller: Address, treasury: Address) {
    caller.require_auth();
    assert_is_emergency_admin(&env, &caller);

    assert!(
        !env.storage().persistent().has(&DataKey::Treasury),
        "Treasury already initialized"
    );

    env.storage()
        .persistent()
        .set(&DataKey::Treasury, &treasury);

    bump_governance_ttl(&env, &DataKey::Treasury);
}

pub(crate) fn get_treasury(env: Env) -> Address {
    treasury_internal(&env)
}

/// Adjusts the go-live fee rate. Not init-once, unlike the treasury and
/// default resolver — the rate is meant to move; only the ceiling
/// (`MAX_FEE_BPS`) is fixed.
pub(crate) fn set_fee_bps(env: Env, caller: Address, fee_bps: u32) {
    caller.require_auth();
    assert_is_emergency_admin(&env, &caller);

    assert!(fee_bps <= MAX_FEE_BPS, "Fee exceeds the maximum allowed");

    env.storage().persistent().set(&DataKey::FeeBps, &fee_bps);

    bump_governance_ttl(&env, &DataKey::FeeBps);
}

pub(crate) fn get_fee_bps(env: Env) -> u32 {
    fee_bps_internal(&env)
}
