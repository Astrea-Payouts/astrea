//! Shared test helpers used across every test module in this crate.

use crate::*;
use soroban_sdk::{token::TokenClient, Address, BytesN, Env};

/// Creates a test token (Stellar Asset Contract) and returns its client
/// both as a TokenClient (transfers) and with mint permissions.
pub(crate) fn create_test_token<'a>(
    env: &Env,

    admin: &Address,
) -> (
    Address,
    TokenClient<'a>,
    soroban_sdk::token::StellarAssetClient<'a>,
) {
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = token_contract.address();
    let token_client = TokenClient::new(env, &token_address);
    let asset_client = soroban_sdk::token::StellarAssetClient::new(env, &token_address);
    (token_address, token_client, asset_client)
}

/// Test-only helper: builds a distinguishable BytesN<16> id for use in tests,
/// simulating a UUID generated off-chain by the backend.
pub(crate) fn test_event_id(env: &Env, n: u8) -> BytesN<16> {
    let mut bytes = [0u8; 16];

    bytes[15] = n;

    BytesN::from_array(env, &bytes)
}

/// Test-only helper: directly overwrites an event's state in storage.
/// Needed to reach states that would otherwise require a full flow
/// (e.g. jumping straight to Ended without a real release_reward call).
pub(crate) fn force_event_state(
    env: &Env,
    contract_id: &Address,
    event_id: BytesN<16>,
    state: EventState,
) {
    env.as_contract(contract_id, || {
        let mut event: Event = env
            .storage()
            .persistent()
            .get(&DataKey::Event(event_id.clone()))
            .unwrap();

        event.state = state;

        env.storage()
            .persistent()
            .set(&DataKey::Event(event_id), &event);
    });
}
