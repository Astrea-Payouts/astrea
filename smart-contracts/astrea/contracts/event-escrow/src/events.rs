//! On-chain events (`#[contractevent]`) published by the contract. Kept
//! separate from `types.rs` because these are wire-format notifications
//! for off-chain observers, not persisted state.

use soroban_sdk::{contractevent, Address, BytesN};

#[contractevent(topics = ["evt_new"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventCreated {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
    pub reward: i128,
}

#[contractevent(topics = ["evt_exp"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventExpired {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
    pub reward: i128,
}

#[contractevent(topics = ["evt_wait"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventWaitingForStart {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
}

#[contractevent(topics = ["evt_run"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventStarted {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
}

#[contractevent(topics = ["evt_cxl"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventCancelled {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
    pub reward: i128,
}

#[contractevent(topics = ["evt_comp"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompensationReleased {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
    pub total: i128,
}

#[contractevent(topics = ["evt_end"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardReleased {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
    pub total_distributed: i128,
}

/// Distinct from `RewardReleased` on purpose: off-chain reconciliation
/// needs to tell a judge release from a resolver-adjudicated one apart.
#[contractevent(topics = ["evt_dsp"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeResolved {
    #[topic]
    pub event_id: BytesN<16>,
    pub resolver: Address,
    pub total_distributed: i128,
}

/// E01b — emitted when a pre-launch two-signature emergency withdraw
/// succeeds. Both `admin` and `resolver` are included since either address
/// alone was insufficient to authorize the withdrawal; the event should let
/// an off-chain observer confirm both signatures were actually present.
#[contractevent(topics = ["evt_ew"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyWithdrawal {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
    pub resolver: Address,
    pub amount: i128,
}

/// Emitted only when `set_event_in_progress` actually moves a nonzero
/// go-live fee — a reward small enough to floor to zero pays nothing and
/// emits nothing. Non-refundable: no other event ever reverses this
/// transfer.
#[contractevent(topics = ["evt_fee"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeCharged {
    #[topic]
    pub event_id: BytesN<16>,
    pub admin: Address,
    pub treasury: Address,
    pub fee: i128,
}

#[contractevent(topics = ["paused"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractPaused {
    pub paused: bool,
}

#[contractevent(topics = ["admpause"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminPaused {
    #[topic]
    pub admin: Address,
    pub paused: bool,
}
