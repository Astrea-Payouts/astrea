//! Data types persisted on-chain: the event state machine, wallet
//! balances, and the storage key enum. Anything wrapped in
//! `#[contracttype]` here is part of the contract's on-chain data model —
//! changing a field here changes what's already stored. See the
//! migration note on `Event::resolver` in build-plan.md / issue #20.

use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum EventState {
    Created = 0,
    WaitingForStart = 1,
    InProgress = 2,
    Ended = 3,
    Compensated = 4,
    Cancelled = 99,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminWallet {
    pub token: Address,
    pub balance: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Event {
    pub admin: Address,
    /// The judge/release-signer for this event — deliberately distinct from
    /// `admin`. The organizer is never in the payout path: `release_reward`
    /// requires this address's auth, not `admin`'s. See ADR-003.
    pub judge: Address,
    pub token: Address,
    /// The resolver's job is narrow and pre-launch-only: co-signing an
    /// emergency withdraw alongside `admin` (E01b). It defaults to Astrea's
    /// own resolver address (see `DataKey::DefaultResolver`) unless the
    /// organizer names one explicitly at `create_event` time (ADR-003).
    pub resolver: Address,
    pub reward: i128,
    pub state: EventState,
    pub deadline: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Participants {
    pub address: Address,
    pub amount_compensation: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Winner {
    pub place: u32,
    pub amount: i128,
    pub address: Address,
}

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Wallet(Address),
    Event(BytesN<16>),
    EventsCount(Address),
    EventIndex(Address, u32),
    EmergencyAdmin,
    /// E01b — Astrea's own resolver address, used as the default for any
    /// `create_event` call that doesn't name one explicitly. Governance
    /// singleton, same init-once shape as `EmergencyAdmin`.
    DefaultResolver,
    Paused,
    AdminPaused(Address),
    TokenWhitelistEnabled,
    AllowedToken(Address),
}
