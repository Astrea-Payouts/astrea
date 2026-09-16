//! TTL-bump coverage (issue #169).
//!
//! `access.rs` extends the TTL of every persistent key class through four
//! near-identical helpers whose bodies differ only in their constants. That
//! shape is exactly where a copy-paste error survives review: bumping the
//! governance key with the wallet helper's 90 days instead of its own 180
//! compiles, runs, and passes every existing test, because nothing reads a TTL
//! back.
//!
//! These tests drive the **real write paths** rather than calling the
//! `pub(crate)` helpers directly. Calling the helper and reading the TTL
//! back would assert that a constant equals itself, which is the one thing not
//! in doubt; what needs proving is that each write path reaches the right
//! helper with the right key.
//!
//! The constants are restated here rather than imported, deliberately. If
//! someone changes a production constant, these tests are supposed to fail and
//! force the change to be looked at, which an import would defeat.

use super::common::*;
use crate::*;
use soroban_sdk::testutils::storage::Persistent as _;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::Address;

const DAY_IN_LEDGERS: u32 = 17280;
/// Every helper uses the same 30-day threshold; only the target differs.
const THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const WALLET_TTL: u32 = 90 * DAY_IN_LEDGERS;
const EVENT_TTL: u32 = 90 * DAY_IN_LEDGERS;
const EVENTS_INDEX_TTL: u32 = 120 * DAY_IN_LEDGERS;
const GOVERNANCE_TTL: u32 = 180 * DAY_IN_LEDGERS;

/// Reads a persistent key's remaining TTL from inside the contract's own
/// storage context.
fn ttl_of<K: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(
    env: &Env,
    contract_id: &Address,
    key: &K,
) -> u32 {
    env.as_contract(contract_id, || env.storage().persistent().get_ttl(key))
}

/// Contract + token + funded admin, the shape every test here starts from.
struct Fixture {
    env: Env,
    contract_id: Address,
    client: EventEscrowClient<'static>,
    token_address: Address,
    admin: Address,
}

fn setup() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    asset_client.mint(&admin, &1_000_000);

    Fixture {
        env,
        contract_id,
        client,
        token_address,
        admin,
    }
}

/// A wallet deposit must land at the wallet constant.
#[test]
fn wallet_write_lands_at_90_days() {
    let f = setup();
    f.client.deposit_funds(&f.admin, &f.token_address, &1_000);

    assert_eq!(
        ttl_of(&f.env, &f.contract_id, &DataKey::Wallet(f.admin.clone())),
        WALLET_TTL,
        "wallet write must extend to 90 days"
    );
}

/// Event creation must land at the event constant, and the per-admin events
/// index and count at the longer index constant.
#[test]
fn event_and_index_writes_land_at_their_own_constants() {
    let f = setup();
    let event_id = test_event_id(&f.env, 1);
    // create_event spends from the wallet, so the wallet has to exist first.
    f.client.deposit_funds(&f.admin, &f.token_address, &1_000);

    f.client.create_event(
        &f.admin,
        &Address::generate(&f.env),
        &Some(Address::generate(&f.env)),
        &f.token_address,
        &100,
        &event_id,
    );

    assert_eq!(
        ttl_of(&f.env, &f.contract_id, &DataKey::Event(event_id.clone())),
        EVENT_TTL,
        "event write must extend to 90 days"
    );
    assert_eq!(
        ttl_of(
            &f.env,
            &f.contract_id,
            &DataKey::EventIndex(f.admin.clone(), 0)
        ),
        EVENTS_INDEX_TTL,
        "events index must extend to 120 days, not the 90 the event helper uses"
    );
    assert_eq!(
        ttl_of(
            &f.env,
            &f.contract_id,
            &DataKey::EventsCount(f.admin.clone())
        ),
        EVENTS_INDEX_TTL,
        "events count must extend to 120 days"
    );
}

/// Every governance singleton and per-admin key must land at the governance
/// constant. This is the class where a copy-paste from the wallet helper would
/// be least visible and most damaging.
#[test]
fn governance_writes_land_at_180_days() {
    let f = setup();
    let emergency_admin = Address::generate(&f.env);
    let other_admin = Address::generate(&f.env);
    let allowed_token = Address::generate(&f.env);

    f.client.initialize_emergency_admin(&emergency_admin);
    assert_eq!(
        ttl_of(&f.env, &f.contract_id, &DataKey::EmergencyAdmin),
        GOVERNANCE_TTL,
        "emergency admin must extend to 180 days"
    );

    f.client
        .initialize_default_resolver(&emergency_admin, &other_admin);
    assert_eq!(
        ttl_of(&f.env, &f.contract_id, &DataKey::DefaultResolver),
        GOVERNANCE_TTL,
    );

    f.client.set_paused(&emergency_admin, &true);
    assert_eq!(
        ttl_of(&f.env, &f.contract_id, &DataKey::Paused),
        GOVERNANCE_TTL,
    );

    f.client.set_admin_paused(&emergency_admin, &f.admin, &true);
    assert_eq!(
        ttl_of(
            &f.env,
            &f.contract_id,
            &DataKey::AdminPaused(f.admin.clone())
        ),
        GOVERNANCE_TTL,
    );

    f.client
        .set_token_whitelist_enabled(&emergency_admin, &true);
    assert_eq!(
        ttl_of(&f.env, &f.contract_id, &DataKey::TokenWhitelistEnabled),
        GOVERNANCE_TTL,
    );

    f.client
        .set_token_allowed(&emergency_admin, &allowed_token, &true);
    assert_eq!(
        ttl_of(
            &f.env,
            &f.contract_id,
            &DataKey::AllowedToken(allowed_token.clone())
        ),
        GOVERNANCE_TTL,
        "allowed token must extend to 180 days"
    );
}

/// A write while the entry is still comfortably above the threshold leaves the
/// TTL alone. `extend_ttl` only acts once the remaining TTL has fallen
/// below its threshold, so this is the control that stops the renewal test
/// below from passing for the wrong reason.
#[test]
fn write_above_threshold_does_not_move_the_ttl() {
    let f = setup();
    let key = DataKey::Wallet(f.admin.clone());

    f.client.deposit_funds(&f.admin, &f.token_address, &1_000);
    assert_eq!(ttl_of(&f.env, &f.contract_id, &key), WALLET_TTL);

    // Five days pass: still 85 days remaining, well above the 30-day
    // threshold, so the extension must be a no-op.
    let start = f.env.ledger().sequence();
    f.env
        .ledger()
        .with_mut(|li| li.sequence_number = start + 5 * DAY_IN_LEDGERS);

    f.client.deposit_funds(&f.admin, &f.token_address, &1_000);

    assert_eq!(
        ttl_of(&f.env, &f.contract_id, &key),
        WALLET_TTL - 5 * DAY_IN_LEDGERS,
        "a write above the threshold must not extend the TTL"
    );
}

/// The property that makes the bump helpers worth having: once the remaining
/// TTL has fallen below the threshold, a later write restores it in full.
/// Without this, `extend_ttl` could be a silent no-op on every path and
/// no existing test would notice.
#[test]
fn later_write_restores_the_ttl_in_full() {
    let f = setup();
    let key = DataKey::Wallet(f.admin.clone());

    f.client.deposit_funds(&f.admin, &f.token_address, &1_000);
    assert_eq!(ttl_of(&f.env, &f.contract_id, &key), WALLET_TTL);

    // Advance far enough that the remaining TTL drops below the 30-day
    // threshold: 61 days leaves 29.
    let start = f.env.ledger().sequence();
    f.env
        .ledger()
        .with_mut(|li| li.sequence_number = start + 61 * DAY_IN_LEDGERS);
    assert!(
        ttl_of(&f.env, &f.contract_id, &key) < THRESHOLD,
        "precondition: the entry must be below the threshold before the write"
    );

    f.client.deposit_funds(&f.admin, &f.token_address, &1_000);

    assert_eq!(
        ttl_of(&f.env, &f.contract_id, &key),
        WALLET_TTL,
        "a write below the threshold must restore the full TTL"
    );
}
