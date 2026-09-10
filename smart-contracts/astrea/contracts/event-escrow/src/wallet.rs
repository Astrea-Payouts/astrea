//! Per-organizer free balance: `deposit_funds`/`withdraw_funds` and the
//! plain `AdminWallet` reads. This is the E01a free-balance-only surface —
//! it never touches funds already reserved by an event. The one sanctioned
//! pre-launch exception to that rule is `lifecycle::emergency_withdraw`
//! (E01b, ADR-006), not anything in this file.

use crate::access::{assert_not_paused, assert_token_allowed, bump_wallet_ttl};
use crate::types::{AdminWallet, DataKey};
use soroban_sdk::{token::TokenClient, Address, Env};

pub(crate) fn deposit_funds(env: Env, admin: Address, token: Address, amount: i128) {
    admin.require_auth();

    assert_not_paused(&env, &admin);

    assert_token_allowed(&env, &token);

    assert!(amount > 0, "Amount must be greater than zero");

    let token_client = TokenClient::new(&env, &token);
    token_client.transfer(&admin, env.current_contract_address(), &amount);

    let key = DataKey::Wallet(admin.clone());
    let mut wallet: AdminWallet = env.storage().persistent().get(&key).unwrap_or(AdminWallet {
        token: token.clone(),

        balance: 0,
    });

    assert_eq!(
        wallet.token, token,
        "This admin already has a wallet with a different token"
    );

    wallet.balance += amount;

    env.storage().persistent().set(&key, &wallet);

    bump_wallet_ttl(&env, &key);
}

pub(crate) fn withdraw_funds(env: Env, admin: Address, amount: i128) {
    admin.require_auth();

    assert_not_paused(&env, &admin);

    assert!(amount > 0, "Amount must be greater than zero");

    let key = DataKey::Wallet(admin.clone());

    let mut wallet: AdminWallet = env
        .storage()
        .persistent()
        .get(&key)
        .expect("Admin has no wallet registered");

    assert!(wallet.balance >= amount, "Insufficient balance in wallet");

    wallet.balance -= amount;

    env.storage().persistent().set(&key, &wallet);

    bump_wallet_ttl(&env, &key);

    let token_client = TokenClient::new(&env, &wallet.token);

    token_client.transfer(&env.current_contract_address(), &admin, &amount);
}

pub(crate) fn get_balance(env: Env, admin: Address) -> i128 {
    let key = DataKey::Wallet(admin);

    let wallet: Option<AdminWallet> = env.storage().persistent().get(&key);

    wallet.map(|w| w.balance).unwrap_or(0)
}

pub(crate) fn has_wallet(env: Env, admin: Address) -> bool {
    env.storage().persistent().has(&DataKey::Wallet(admin))
}
