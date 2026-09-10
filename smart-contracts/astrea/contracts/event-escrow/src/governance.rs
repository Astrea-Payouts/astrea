//! Emergency-admin controlled knobs: pausing (global or per-organizer),
//! the token whitelist, and the two governance singletons
//! (`EmergencyAdmin` itself, and E01b's `DefaultResolver`). Nothing here
//! touches an individual event or wallet directly — it only gates whether
//! other modules' functions are allowed to run.

use crate::access::{
    assert_is_emergency_admin, bump_governance_ttl,
    get_default_resolver as default_resolver_internal, is_token_allowed_internal,
};
use crate::events::{AdminPaused, ContractPaused};
use crate::types::DataKey;
use soroban_sdk::{Address, Env};

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
