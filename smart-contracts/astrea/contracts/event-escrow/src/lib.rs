#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token::TokenClient, Address, BytesN, Env,
    Vec,
};

const DAY_IN_LEDGERS: u32 = 17280;
const WALLET_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const WALLET_TTL_EXTEND_TO: u32 = 90 * DAY_IN_LEDGERS;
const EVENT_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const EVENT_TTL_EXTEND_TO: u32 = 90 * DAY_IN_LEDGERS;
const EVENTS_INDEX_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const EVENTS_INDEX_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;
const GOVERNANCE_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const GOVERNANCE_TTL_EXTEND_TO: u32 = 180 * DAY_IN_LEDGERS;

/// K06 (spikes/k06-multi-release-budget) validated a single `release_reward`
/// call paying up to 25 winners stays well inside the Stellar Mainnet
/// instruction budget (~1.2% of it). This is an on-chain enforcement of
/// that validated bound, not an arbitrary limit — an unbounded winners
/// list is a griefing vector: a judge could submit a list large enough to
/// blow the transaction's resource budget mid-call, aborting a legitimate
/// event close with no recovery path until the dispute mechanism (#22)
/// exists.
const MAX_WINNERS: u32 = 25;

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
    Paused,
    AdminPaused(Address),
    TokenWhitelistEnabled,
    AllowedToken(Address),
}

fn bump_wallet_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, WALLET_TTL_THRESHOLD, WALLET_TTL_EXTEND_TO);
}

fn bump_event_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, EVENT_TTL_THRESHOLD, EVENT_TTL_EXTEND_TO);
}

fn bump_events_index_ttl(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(
        key,
        EVENTS_INDEX_TTL_THRESHOLD,
        EVENTS_INDEX_TTL_EXTEND_TO,
    );
}

fn bump_governance_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, GOVERNANCE_TTL_THRESHOLD, GOVERNANCE_TTL_EXTEND_TO);
}

fn assert_not_paused(env: &Env, admin: &Address) {
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

fn assert_is_emergency_admin(env: &Env, caller: &Address) {
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

/// Token whitelist is **default-deny-disabled**, i.e. any SEP-41 token is
/// accepted unless `set_token_whitelist_enabled(true)` has been called by
/// the emergency admin. This is a deliberate, documented decision for the
/// current testnet/pilot phase, not an oversight: it keeps the contract
/// usable while the token policy is still being decided. Before accepting
/// real (non-testnet) funds, enable the whitelist and populate it with the
/// specific tokens Astrea intends to support (e.g. USDC) — see the Council
/// review referenced in build-plan.md's security pass (L01).
fn is_token_allowed_internal(env: &Env, token: &Address) -> bool {
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

fn assert_token_allowed(env: &Env, token: &Address) {
    assert!(
        is_token_allowed_internal(env, token),
        "Token is not allowed"
    );
}

fn create_event_internal(
    env: Env,
    admin: Address,
    judge: Address,
    token: Address,
    reward: i128,
    event_id: BytesN<16>,
    deadline: Option<u64>,
) -> BytesN<16> {
    admin.require_auth();

    assert_not_paused(&env, &admin);

    assert_token_allowed(&env, &token);

    assert!(reward > 0, "Reward must be greater than zero");

    if let Some(d) = deadline {
        assert!(
            d > env.ledger().timestamp(),
            "Deadline must be in the future"
        );
    }

    let event_key = DataKey::Event(event_id.clone());

    assert!(
        !env.storage().persistent().has(&event_key),
        "Event already exists"
    );

    let wallet_key = DataKey::Wallet(admin.clone());

    let mut wallet: AdminWallet = env
        .storage()
        .persistent()
        .get(&wallet_key)
        .expect("Admin must deposit funds before the event");

    assert!(
        wallet.token == token,
        "Admin wallet token doesn't match the event's token"
    );

    assert!(
        wallet.balance >= reward,
        "Insufficient balance in wallet to create event"
    );

    wallet.balance -= reward;

    env.storage().persistent().set(&wallet_key, &wallet);

    bump_wallet_ttl(&env, &wallet_key);

    let event = Event {
        admin: admin.clone(),
        judge,
        token,
        reward,
        state: EventState::Created,
        deadline,
    };

    env.storage().persistent().set(&event_key, &event);

    bump_event_ttl(&env, &event_key);
    let count_key = DataKey::EventsCount(admin.clone());
    let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
    let index_key = DataKey::EventIndex(admin.clone(), count);

    env.storage().persistent().set(&index_key, &event_id);
    bump_events_index_ttl(&env, &index_key);

    env.storage().persistent().set(&count_key, &(count + 1));
    bump_events_index_ttl(&env, &count_key);

    EventCreated {
        event_id: event_id.clone(),
        admin: admin.clone(),
        reward: event.reward,
    }
    .publish(&env);

    event_id
}

#[contract]
pub struct EventEscrow;

#[contractimpl]
impl EventEscrow {
    pub fn deposit_funds(env: Env, admin: Address, token: Address, amount: i128) {
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

    pub fn withdraw_funds(env: Env, admin: Address, amount: i128) {
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

    pub fn get_balance(env: Env, admin: Address) -> i128 {
        let key = DataKey::Wallet(admin);

        let wallet: Option<AdminWallet> = env.storage().persistent().get(&key);

        wallet.map(|w| w.balance).unwrap_or(0)
    }

    pub fn has_wallet(env: Env, admin: Address) -> bool {
        env.storage().persistent().has(&DataKey::Wallet(admin))
    }

    pub fn create_event(
        env: Env,

        admin: Address,

        judge: Address,

        token: Address,

        reward: i128,

        event_id: BytesN<16>,
    ) -> BytesN<16> {
        create_event_internal(env, admin, judge, token, reward, event_id, None)
    }

    pub fn create_event_with_deadline(
        env: Env,
        admin: Address,
        judge: Address,
        token: Address,
        reward: i128,
        event_id: BytesN<16>,
        deadline: u64,
    ) -> BytesN<16> {
        create_event_internal(env, admin, judge, token, reward, event_id, Some(deadline))
    }

    pub fn expire_event(env: Env, event_id: BytesN<16>) {
        let event_key = DataKey::Event(event_id.clone());

        let mut event: Event = env
            .storage()
            .persistent()
            .get(&event_key)
            .expect("Event does not exist");

        assert!(
            event.state == EventState::Created
                || event.state == EventState::WaitingForStart
                || event.state == EventState::InProgress,
            "Event cannot be expired in its current state"
        );

        let deadline = event.deadline.expect("Event has no deadline configured");

        assert!(
            env.ledger().timestamp() >= deadline,
            "Event deadline has not passed yet"
        );

        event.state = EventState::Cancelled;

        env.storage().persistent().set(&event_key, &event);

        bump_event_ttl(&env, &event_key);

        let wallet_key = DataKey::Wallet(event.admin.clone());

        let mut wallet: AdminWallet = env
            .storage()
            .persistent()
            .get(&wallet_key)
            .expect("Admin has no wallet registered");

        wallet.balance += event.reward;

        env.storage().persistent().set(&wallet_key, &wallet);

        bump_wallet_ttl(&env, &wallet_key);

        EventExpired {
            event_id,
            admin: event.admin,
            reward: event.reward,
        }
        .publish(&env);
    }

    pub fn set_event_waiting_for_start(env: Env, admin: Address, event_id: BytesN<16>) {
        admin.require_auth();

        assert_not_paused(&env, &admin);

        let event_key = DataKey::Event(event_id.clone());

        let mut event: Event = env
            .storage()
            .persistent()
            .get(&event_key)
            .expect("Event does not exist");

        assert_eq!(
            event.admin, admin,
            "Only the event admin can update the event"
        );

        assert_eq!(
            event.state,
            EventState::Created,
            "Event must be in Created state to wait for start"
        );

        event.state = EventState::WaitingForStart;

        env.storage().persistent().set(&event_key, &event);

        bump_event_ttl(&env, &event_key);

        EventWaitingForStart { event_id, admin }.publish(&env);
    }

    pub fn set_event_in_progress(env: Env, admin: Address, event_id: BytesN<16>) {
        admin.require_auth();

        assert_not_paused(&env, &admin);

        let event_key = DataKey::Event(event_id.clone());

        let mut event: Event = env
            .storage()
            .persistent()
            .get(&event_key)
            .expect("Event does not exist");

        assert_eq!(
            event.admin, admin,
            "Only the event admin can start the event"
        );

        assert!(
            event.state == EventState::Created || event.state == EventState::WaitingForStart,
            "Event must be in Created or WaitingForStart state to start"
        );

        event.state = EventState::InProgress;

        env.storage().persistent().set(&event_key, &event);

        bump_event_ttl(&env, &event_key);

        EventStarted { event_id, admin }.publish(&env);
    }

    pub fn set_event_cancelled(env: Env, admin: Address, event_id: BytesN<16>) {
        admin.require_auth();

        assert_not_paused(&env, &admin);

        let event_key = DataKey::Event(event_id.clone());

        let mut event: Event = env
            .storage()
            .persistent()
            .get(&event_key)
            .expect("Event does not exist");

        assert_eq!(
            event.admin, admin,
            "Only the event admin can cancel the event"
        );

        // InProgress is deliberately excluded: cancelling a live event with an
        // automatic, unconditional refund would let an organizer extract
        // participants' already-invested work for free (ADR-006). Once an
        // event is InProgress, unwinding it requires a resolver-adjudicated
        // dispute instead (build-plan.md E01d/#22) — not implemented yet, so
        // for now an InProgress event simply cannot be cancelled at all. That
        // is the correct, safe interim state (fails closed).
        assert!(
            event.state == EventState::Created || event.state == EventState::WaitingForStart,
            "Event cannot be cancelled in its current state"
        );

        event.state = EventState::Cancelled;

        env.storage().persistent().set(&event_key, &event);

        bump_event_ttl(&env, &event_key);

        let wallet_key = DataKey::Wallet(admin.clone());

        let mut wallet: AdminWallet = env
            .storage()
            .persistent()
            .get(&wallet_key)
            .expect("Admin has no wallet registered");

        wallet.balance += event.reward;

        env.storage().persistent().set(&wallet_key, &wallet);

        bump_wallet_ttl(&env, &wallet_key);

        EventCancelled {
            event_id,
            admin: admin.clone(),
            reward: event.reward,
        }
        .publish(&env);
    }

    pub fn release_compensation(
        env: Env,
        admin: Address,
        event_id: BytesN<16>,
        participants: Vec<Participants>,
    ) {
        admin.require_auth();

        assert_not_paused(&env, &admin);

        let event_key = DataKey::Event(event_id.clone());

        let mut event: Event = env
            .storage()
            .persistent()
            .get(&event_key)
            .expect("Event does not exist");

        assert_eq!(
            event.admin, admin,
            "Only admin can release the compensation"
        );

        assert_eq!(event.state, EventState::Cancelled, "Event is not cancelled");

        assert!(!participants.is_empty(), "No participants provided");

        for p in participants.iter() {
            assert!(
                p.amount_compensation > 0,
                "Compensation must be greater than zero"
            );
        }

        let total: i128 = participants.iter().map(|p| p.amount_compensation).sum();

        let wallet_key = DataKey::Wallet(admin.clone());

        let mut wallet: AdminWallet = env
            .storage()
            .persistent()
            .get(&wallet_key)
            .expect("Admin has no wallet registered");

        assert!(
            wallet.balance >= total,
            "Insufficient wallet balance to cover compensation"
        );

        wallet.balance -= total;

        env.storage().persistent().set(&wallet_key, &wallet);

        bump_wallet_ttl(&env, &wallet_key);

        let token_client = TokenClient::new(&env, &wallet.token);

        for p in participants.iter() {
            token_client.transfer(
                &env.current_contract_address(),
                &p.address,
                &p.amount_compensation,
            );
        }

        event.state = EventState::Compensated;

        env.storage().persistent().set(&event_key, &event);

        bump_event_ttl(&env, &event_key);

        CompensationReleased {
            event_id,
            admin: admin.clone(),
            total,
        }
        .publish(&env);
    }

    pub fn release_reward(env: Env, judge: Address, event_id: BytesN<16>, winners: Vec<Winner>) {
        judge.require_auth();

        let event_key = DataKey::Event(event_id.clone());

        let mut event: Event = env
            .storage()
            .persistent()
            .get(&event_key)
            .expect("Event does not exist");

        assert_not_paused(&env, &event.admin);

        assert!(
            event.judge == judge,
            "Only the event's judge can release rewards"
        );

        assert!(
            event.state == EventState::InProgress,
            "Event is not ready to release rewards"
        );

        assert!(
            winners.len() <= MAX_WINNERS,
            "Too many winners in a single release"
        );

        for winner in winners.iter() {
            assert!(winner.amount > 0, "Winner amount must be greater than zero");
        }

        let total_distributed: i128 = winners.iter().map(|w| w.amount).sum();

        assert_eq!(
            total_distributed, event.reward,
            "Distributed amount does not match the locked reward"
        );

        event.state = EventState::Ended;
        env.storage().persistent().set(&event_key, &event);
        bump_event_ttl(&env, &event_key);
        let token_client = TokenClient::new(&env, &event.token);

        for winner in winners.iter() {
            token_client.transfer(
                &env.current_contract_address(),
                &winner.address,
                &winner.amount,
            );
        }

        RewardReleased {
            event_id,
            admin: event.admin.clone(),
            total_distributed,
        }
        .publish(&env);
    }

    pub fn get_events_by_admin(env: Env, admin: Address) -> Vec<BytesN<16>> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::EventsCount(admin.clone()))
            .unwrap_or(0);

        let mut result: Vec<BytesN<16>> = Vec::new(&env);

        for i in 0..count {
            let id: BytesN<16> = env
                .storage()
                .persistent()
                .get(&DataKey::EventIndex(admin.clone(), i))
                .unwrap();

            result.push_back(id);
        }

        result
    }

    pub fn get_events_by_admin_page(
        env: Env,
        admin: Address,
        offset: u32,
        limit: u32,
    ) -> Vec<BytesN<16>> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::EventsCount(admin.clone()))
            .unwrap_or(0);

        let requested_end = offset.saturating_add(limit);

        let end = if requested_end < count {
            requested_end
        } else {
            count
        };

        let mut result: Vec<BytesN<16>> = Vec::new(&env);

        let mut i = offset;

        while i < end {
            let id: BytesN<16> = env
                .storage()
                .persistent()
                .get(&DataKey::EventIndex(admin.clone(), i))
                .unwrap();

            result.push_back(id);

            i += 1;
        }

        result
    }

    pub fn get_events_by_admin_count(env: Env, admin: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::EventsCount(admin))
            .unwrap_or(0)
    }

    pub fn get_event(env: Env, event_id: BytesN<16>) -> Event {
        env.storage()
            .persistent()
            .get(&DataKey::Event(event_id))
            .expect("Event does not exist")
    }

    pub fn initialize_emergency_admin(env: Env, emergency_admin: Address) {
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

    pub fn set_paused(env: Env, caller: Address, paused: bool) {
        caller.require_auth();
        assert_is_emergency_admin(&env, &caller);
        env.storage().persistent().set(&DataKey::Paused, &paused);
        bump_governance_ttl(&env, &DataKey::Paused);
        ContractPaused { paused }.publish(&env);
    }

    pub fn set_admin_paused(env: Env, caller: Address, target_admin: Address, paused: bool) {
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

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn is_admin_paused(env: Env, admin: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::AdminPaused(admin))
            .unwrap_or(false)
    }

    pub fn set_token_whitelist_enabled(env: Env, caller: Address, enabled: bool) {
        caller.require_auth();

        assert_is_emergency_admin(&env, &caller);

        env.storage()
            .persistent()
            .set(&DataKey::TokenWhitelistEnabled, &enabled);

        bump_governance_ttl(&env, &DataKey::TokenWhitelistEnabled);
    }

    pub fn set_token_allowed(env: Env, caller: Address, token: Address, allowed: bool) {
        caller.require_auth();
        assert_is_emergency_admin(&env, &caller);
        let key = DataKey::AllowedToken(token);

        env.storage().persistent().set(&key, &allowed);
        bump_governance_ttl(&env, &key);
    }

    pub fn is_token_allowed(env: Env, token: Address) -> bool {
        is_token_allowed_internal(&env, &token)
    }
}

mod test;
