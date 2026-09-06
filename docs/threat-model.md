# Astrea Event Escrow — Threat Model & Security Architecture

**Document Version:** 1.0.0  
**Target Contract:** `smart-contracts/astrea/contracts/event-escrow`  
**Execution Environment:** Stellar Soroban (Rust SDK, `no_std`, WASM)  
**Readiness Target:** Soroban Audit Bank / Stellar Community Fund (SCF #46)  
**Related ADRs:** ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006  
**Spike Validations:** K01 (Role Model), K02 (Go SDK), K06 (Resource Budget)

---

## 1. Executive Summary & Purpose

This document provides the formal threat model and security architecture for Astrea's shared `EventEscrow` smart contract. Astrea secures prize payouts for hackathons, bounties, and competitive development challenges by locking funds into on-chain escrow before competitions begin.

Because Astrea operates an owned, custom Soroban smart contract rather than relying on a third-party custodial provider (ADR-001), the contract bears full structural responsibility for fund safety, non-custodial custody, and authorization integrity. This threat model deconstructs:
1. **Assets** under contract custody and storage management.
2. **Actors and Trust Boundaries** governing who can sign and submit state transitions.
3. **Privilege Matrix** mapping on-chain function entry points to required cryptographic authorizations.
4. **Threat Analysis via STRIDE** detailing threat vectors, attacker incentives, and verified on-chain mitigations.
5. **Residual Risks & Open Workstreams** cross-referencing known tracking issues (#20, #22).

---

## 2. System Architecture & Assets

### 2.1 Core Contract Architecture (ADR-006)
Astrea uses a **shared multi-tenant contract** model rather than deploying a new contract instance per event. A single deployed contract instance manages:
- Per-organizer free balances stored in `AdminWallet`.
- Independent, milestone-based competition escrows (`Event`).
- Global and per-admin pause states managed by an `EmergencyAdmin`.

```
                  +-------------------------------------------------+
                  |          Astrea EventEscrow Contract            |
                  +-------------------------------------------------+
                                      |
            +-------------------------+-------------------------+
            |                                                   |
            v                                                   v
+-----------------------+                           +-----------------------+
|  AdminWallet (Free)   |                           |  Event Escrow (Locked)|
|  - token: Address     | -- create_event(reward)-> |  - admin: Address     |
|  - balance: i128      |                           |  - judge: Address     |
+-----------------------+                           |  - reward: i128       |
            ^                                       |  - state: EventState  |
            |                                       +-----------------------+
     deposit / withdraw                                         |
            |                                          release_reward(winners)
    [ Organizer / Admin ]                                       |
                                                                v
                                                       [ Winners / Wallets ]
```

### 2.2 Assets Under Protection

| Asset ID | Asset Description | Storage Key & Scope | Impact of Compromise |
| --- | --- | --- | --- |
| **A1: Organizer Free Balance** | Liquid SEP-41 token balances deposited by an organizer but not yet committed to any event. | `DataKey::Wallet(admin)` (Persistent Storage) | Unauthorized withdrawal, theft of uncommitted organizer treasury. |
| **A2: Event Prize Escrow** | Token balances committed and reserved for active competitions. | `DataKey::Event(event_id)` (Persistent Storage) | Premature draining, organizer rugpull, participant labor theft. |
| **A3: Physical Contract Vault** | The cumulative SEP-41 token balance held at `env.current_contract_address()`. | Stellar Ledger Token Balance | Systemic insolvency across all organizers and events. |
| **A4: State Machine Integrity** | The valid progression of event lifecycle states (`Created` -> `WaitingForStart` -> `InProgress` -> `Ended` / `Cancelled`). | `Event.state` | Bypassing judging, unearned prize distribution, deadlocked funds. |
| **A5: Ledger Storage TTL** | Persistent contract data retention across ledger epochs. | Storage TTL Thresholds (30 to 180 days) | Unrecoverable state loss due to ledger archival. |

---

## 3. Actors & Trust Boundaries

### 3.1 Actor Definitions

1. **Organizer (`admin`)**:
   - The entity funding and launching the competition.
   - Holds administrative sovereignty over their own `AdminWallet` and event creation.
   - **Critical Boundary (ADR-003):** The organizer is strictly excluded from the payout release path once an event is active.
2. **Judge (`judge`)**:
   - Designated evaluation authority for a competition (individual address or multisig account).
   - Responsible for evaluating deliverables and distributing rewards via `release_reward`.
   - **Critical Boundary (ADR-003):** The judge cannot withdraw organizer balances, cannot cancel events, and cannot alter the locked prize amount.
3. **Emergency Admin (`emergency_admin`)**:
   - Platform governance authority initialized once at deployment (`DataKey::EmergencyAdmin`).
   - Responsible for operational safety: emergency circuit-breaker pauses and token whitelist management.
   - **Critical Boundary:** The emergency admin has zero authority to withdraw funds, redirect rewards, or bypass judge signatures.
4. **Participant / Winner**:
   - Builders competing in events.
   - Pure recipients of prize allocations; no privileged contract entry points.
5. **Resolver (Dispute Arbiter)**:
   - Third-party arbiter (Astrea default multisig or custom designated address, ADR-003).
   - Arbitrates disputes when judging deadlines pass or contested outcomes occur.
6. **Anonymous Caller / Relayer**:
   - Any public Stellar account executing permissionless maintenance methods (e.g. `expire_event` after deadline).

---

## 4. Privilege Matrix & Authorization Rules

Every state-mutating function in `lib.rs` strictly enforces cryptographic authentication via Soroban's native `require_auth()`:

| Function | Required Caller Auth | Prerequisites / Guards | Permitted Action |
| --- | --- | --- | --- |
| `deposit_funds` | `admin.require_auth()` | Contract not paused; token allowed; amount > 0 | Transfers tokens from caller to contract; credits `AdminWallet`. |
| `withdraw_funds` | `admin.require_auth()` | Contract not paused; caller not admin-paused; amount <= free balance | Deducts free balance from `AdminWallet`; transfers tokens to caller. |
| `create_event` / `create_event_with_deadline` | `admin.require_auth()` | Token allowed; reward > 0; free balance >= reward; unique `event_id` | Deducts reward from `AdminWallet`; locks into new `Event` with state `Created`. |
| `set_event_waiting_for_start` | `admin.require_auth()` | Caller == `event.admin`; state == `Created` | Transitions event state to `WaitingForStart`. |
| `set_event_in_progress` | `admin.require_auth()` | Caller == `event.admin`; state in (`Created`, `WaitingForStart`) | Transitions event state to `InProgress`. |
| `set_event_cancelled` | `admin.require_auth()` | Caller == `event.admin`; state in (`Created`, `WaitingForStart`) | Cancels unstarted event; returns full locked reward to `AdminWallet`. |
| `release_compensation` | `admin.require_auth()` | Caller == `event.admin`; state == `Cancelled`; sum(compensation) <= balance | Pays discretionary compensation to participants from organizer balance. |
| `release_reward` | `judge.require_auth()` | Caller == `event.judge`; state == `InProgress`; len(winners) <= 25; sum(winners) == `event.reward` | Transfers tokens directly to winner addresses; sets state to `Ended`. |
| `expire_event` | None (Permissionless) | State in (`Created`, `WaitingForStart`, `InProgress`); ledger timestamp >= deadline | Refunds reward back to organizer `AdminWallet`; sets state to `Cancelled`. |
| `set_paused` | `emergency_admin.require_auth()` | None | Globally pauses/unpauses all user deposits, withdrawals, and event launches. |
| `set_admin_paused` | `emergency_admin.require_auth()` | None | Freezes operations for a specific flagged organizer address. |
| `set_token_allowed` | `emergency_admin.require_auth()` | None | Adds/removes tokens from the authorized whitelist. |

---

## 5. Threat Analysis (STRIDE)

### 5.1 Spoofing Identity
* **Threat T1: Attacker impersonates Organizer to withdraw unearned funds.**
  * *Vector:* Attacker calls `withdraw_funds(env, victim_admin, amount)`.
  * *Mitigation:* `lib.rs:377` executes `admin.require_auth()`. Soroban host environment cryptographically validates the cryptographic signature or contract invocation tree matching `admin`.
  * *Verification:* Test `test_withdraw_funds_rejects_unauthorized` rejects with HostError.
* **Threat T2: Compromised or unauthorized third party signs reward release.**
  * *Vector:* Attacker attempts to call `release_reward` with their own signature.
  * *Mitigation:* `lib.rs:698-713` verifies `judge.require_auth()` AND explicitly asserts `event.judge == judge`.
  * *Verification:* Verified in K01 testnet spike (`CBFPD...`) and unit test `test_release_reward_rejects_non_owner_admin`.

### 5.2 Tampering with Data
* **Threat T3: Organizer attempts to rugpull active participants by cancelling a live event.**
  * *Vector:* Organizer launches an event, participants submit code, organizer calls `set_event_cancelled` to recover the reward.
  * *Mitigation (ADR-006):* `lib.rs:585-588` enforces:
    ```rust
    assert!(
        event.state == EventState::Created || event.state == EventState::WaitingForStart,
        "Event cannot be cancelled in its current state"
    );
    ```
    Once an event is `InProgress`, direct cancellation reverts. Unwinding an active event requires dispute resolution.
  * *Verification:* Test `test_set_event_cancelled_rejects_in_progress_state` confirms rejection.
* **Threat T4: Judge attempts to alter total prize distribution.**
  * *Vector:* Judge distributes less than the escrowed reward and retains the remainder, or distributes more to create insolvency.
  * *Mitigation:* `lib.rs:729-734` computes the exact sum of winner allocations and asserts:
    ```rust
    let total_distributed: i128 = winners.iter().map(|w| w.amount).sum();
    assert_eq!(total_distributed, event.reward, "Distributed amount does not match the locked reward");
    ```
  * *Verification:* Tests `test_release_reward_rejects_mismatched_total` and `test_release_reward_rejects_negative_amount_winner_even_if_sum_matches`.

### 5.3 Repudiation
* **Threat T5: Organizer denies having funded an event or claims incorrect payout amounts.**
  * *Mitigation:* Every lifecycle transition emits strongly-typed Soroban contract events:
    - `EventCreated` (event_id, admin, reward)
    - `EventStarted` (event_id, admin)
    - `EventCancelled` (event_id, admin, reward)
    - `RewardReleased` (event_id, admin, total_distributed)
    - `CompensationReleased` (event_id, admin, total)
  * Off-chain indexers and reconciliation daemons (`OpLog` / Horizon) verify tx hashes directly against ledger event topics.

### 5.4 Information Disclosure
* **Threat T6: Sensitive participant data leaked on-chain.**
  * *Mitigation:* The contract stores zero personal identity information (PII). Storage keys only contain Stellar addresses, 16-byte event identifiers, token addresses, and integer balances. Registration questions and private submissions remain off-chain in encrypted database storage.

### 5.5 Denial of Service (DoS & Griefing)
* **Threat T7: Out-of-gas griefing via bloated winners list.**
  * *Vector:* Malicious judge passes an array of 5,000 winners to `release_reward`, exceeding Stellar transaction CPU/instruction ceilings and permanently bricking the payout.
  * *Mitigation (K06 Constraint):* `lib.rs:26` and `lib.rs:721` enforce hard ceiling `MAX_WINNERS = 25`. Spike K06 validated that 25 winner payouts consume ~1.2% of Stellar Mainnet CPU budget.
  * *Verification:* Test `test_release_reward_rejects_too_many_winners` asserts revert when `winners.len() > 25`.
* **Threat T8: Silent judge abandoning competition and locking funds forever.**
  * *Vector:* Appointed judge becomes unresponsive or refuses to evaluate submissions.
  * *Mitigation:* `expire_event` entry point (`lib.rs:444`). If organizer configured `deadline: Some(timestamp)` during `create_event_with_deadline`, once `ledger.timestamp >= deadline`, anyone can trigger expiration, returning escrowed funds back to the organizer's `AdminWallet`. For active judging disputes prior to expiration, dispute resolution (Issue #22) acts as the secondary relief valve.
  * *Verification:* Test `test_expire_event_refunds_after_deadline` and `test_expire_event_rejects_before_deadline`.
* **Threat T9: Storage archival causing contract state disappearance.**
  * *Mitigation:* Soroban State Archival requires TTL renewal. All entry points execute proactive TTL bumping (`bump_wallet_ttl`, `bump_event_ttl`, `bump_events_index_ttl`) extending instance and persistent keys to 90-180 days on every interaction.

### 5.6 Elevation of Privilege
* **Threat T10: Organizer self-releases prize rewards.**
  * *Vector:* Organizer attempts to call `release_reward` specifying themselves as winner.
  * *Mitigation (ADR-003):* The organizer is structurally barred. `release_reward` requires `judge.require_auth()`. Furthermore, even if the organizer acts as judge (discouraged in production UI), `lib.rs` prevents release before `InProgress`.
  * *Verification:* Test `test_release_reward_rejects_the_organizer_itself` explicitly asserts rejection if `admin == judge`.
* **Threat T11: Emergency Admin drains funds during an emergency pause.**
  * *Vector:* Emergency admin pauses the contract and attempts to withdraw locked user funds.
  * *Mitigation:* Zero fund-movement entry points exist for `emergency_admin`. The emergency admin role is restricted exclusively to boolean state toggles (`DataKey::Paused`, `DataKey::AdminPaused`, `DataKey::TokenWhitelistEnabled`).
  * *Verification:* Inspected ABI surfaces; `withdraw_funds` requires `admin.require_auth()` corresponding to the specific `AdminWallet`.

---

## 6. Residual Risks & Open Workstreams

While the core escrow contract demonstrates robust negative-path test coverage, the following operational and technical items are tracked for Phase 2 mainnet readiness:

1. **Issue #22: Formal On-Chain Dispute Architecture (`dispute` / `resolve_dispute`)**:
   - *Current State:* If an active event reaches an impasse without an expiration deadline, the contract fails closed (`InProgress` cannot be cancelled).
   - *Planned Resolution:* Issue #22 adds explicit resolver-adjudicated dispute triggers allowing the designated resolver to override an uncooperative judge.
2. **Issue #20: Pre-Launch Refund vs Post-Launch Dispute Routing**:
   - *Current State:* Pre-launch cancellation refunds immediately; post-launch cancellation is rejected.
   - *Planned Resolution:* Connect organizer dashboard UI directly to the dispute submission pipeline when requesting cancellation after `InProgress`.
3. **Off-Chain Collusion (Malicious Organizer + Corrupt Judge)**:
   - *Residual Threat:* If the same entity controls both `admin` and `judge` keys, they can launch an event, attract builder submissions, and award the prize to a sybil address.
   - *Mitigations:*
     - Public reputation and verified judge display on the event page prior to launch (ADR-003).
     - UI enforcement recommending multi-judge Stellar multisig accounts (`2-of-3`) for high-value competitions.
     - Integration of dispute resolver backstops.
4. **Token Contract Malice (Non-Compliant SEP-41 Tokens)**:
   - *Residual Threat:* Reentrancy or fee-on-transfer tokens disrupting accounting.
   - *Mitigation:* Token whitelist is enforced in production (`TokenWhitelistEnabled`). Only trusted standard tokens (e.g. native USDC issued by Circle) are whitelisted on mainnet.

---

## 7. Audit Bank Readiness Verification Checklist

- [x] **Threat model written down (L01a)**: Assets, actors, trust boundaries, STRIDE analysis, and mitigations documented.
- [x] **Role Model Security Tested (K01)**: Organizer excluded from payout path; judge dual-role verified.
- [x] **Instruction Budget Validated (K06)**: Max 25 winners per transaction enforced to prevent DoS.
- [x] **Storage State Archival Handled**: Automatic persistent TTL extension on all active keys.
- [ ] **On-Chain Dispute Mechanism Landed**: Issue #22 implementation in progress.
- [ ] **External Security Audit Conducted (L01)**: To be scheduled via Soroban Audit Bank.
