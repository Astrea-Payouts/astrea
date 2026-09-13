# Threat model: event-escrow

A written threat model of the escrow contract, for the Soroban Audit Bank
readiness assessment (#107, L01a) and for an external auditor who would
otherwise reverse-engineer intent from Rust.

Every claim below is grounded in an ADR, a spike finding, or a specific
function. Where the code is the only source of truth the function is named
rather than its intent asserted. Design names and implemented names differ —
docs/architecture.md carries the mapping — and this document uses the
implemented ones.

---

## 1. Assets

| Asset | Where it lives | What it is |
| --- | --- | --- |
| Organizer free balance | DataKey::Wallet(admin) | Funds deposited via deposit_funds and not yet committed to an event. Withdrawable at any time by the organizer (ADR-006). |
| Event reward | DataKey::Event(id).reward, a single i128 | Committed at create_event by moving value out of the free balance. Per ADR-006 it is a separate ledger entry: once committed it is no longer withdrawable as free balance, and withdraw_funds cannot reach it. |
| The declared prize breakdown | Off-chain only | How the organizer declared the reward should be split across positions (#54). See section 4.4 — this is the one asset with no on-chain representation at all. |
| Participant and submission data | Off-chain (Postgres), referenced by event id | Not held by the contract. In scope only where the contract's outcome depends on it. |

The contract holds no key material, and there is no per-event contract
instance: all organizers share one (ADR-006).

## 2. Actors, authority, and what each is explicitly prevented from doing

Authority below is read off the require_auth calls and the identity assertions
that follow them, not off the ADRs.

| Actor | Can authorize | Explicitly cannot |
| --- | --- | --- |
| Organizer (admin) | deposit_funds, withdraw_funds on its own free balance, create_event, the state machine (set_event_waiting_for_start / set_event_in_progress / set_event_cancelled, each asserting event.admin == admin), and release_compensation on a cancelled event | **Move escrowed reward to a winner.** No organizer-callable function pays a winner; ADR-003 makes this structural, and K01/K02 verified on testnet that an organizer-signed release is rejected by the contract's own require_auth. |
| Judge (event.judge) | release_reward — the sole release path. It asserts event.judge == judge, so it is the named judge only, not any signer. | Release before InProgress; release twice, since state flips to Ended; pay more than the committed reward in total (section 4.4). Cannot touch the free balance. |
| Resolver (event.resolver) | Co-authorizes emergency_withdraw together with the organizer — dual authorization, both require_auth calls present. | **Unilaterally move funds.** emergency_withdraw needs the organizer's signature too, so a compromised resolver alone drains nothing. Open a dispute on its own escrow — that entry point does not exist yet (section 6). |
| Anyone | expire_event — permissionless, no require_auth call at all (section 4.5). | — |
| Winner | Nothing. Receives; never authorizes. | — |

## 3. Trust boundaries

- **Contract to client.** The wallet-connection cookie is a UX session, not an
  authorization boundary (ADR-005): it is set from a client-asserted address
  with no signature challenge. That is safe only because no money movement
  relies on it — every value-moving call carries its own require_auth, and
  Stellar's auth framework checks signatures, not cookies. Any future change
  that lets that cookie stand in for authorization crosses this boundary.
- **Contract to Go service.** The service holds operator keys and submits
  transactions. It is trusted to submit correct calls but not to be able to
  force invalid ones: the contract re-checks identity and state on every path.
- **Contract to organizers.** Untrusted. Any organizer is adversarial input.
- **Contract to judge and resolver.** Untrusted but privileged. ADR-003 names
  both as the residual trust; they can go silent or collude, mitigated by
  publishing their identities before the event starts.

## 4. Attack scenarios

Each scenario states what the actor would try, whether the current auth model
stops it, and which test covers it. Test names are from the contract's own
suite under src/test/.

### 4.1 Organizer tries to release the reward themselves

**Stopped on-chain.** No organizer-callable function pays a winner, and
release_reward requires judge auth plus event.judge == judge. Covered by the
wrong-admin and wrong-signer negative tests across wallet, lifecycle and
governance (for example test_set_event_waiting_for_start_rejects_wrong_admin).
ADR-003 records the K01/K02 testnet verification.

### 4.2 Judge releases twice, or before the event is running

**Stopped on-chain.** release_reward asserts state == InProgress and flips to
Ended, so a second call fails the state assertion and an early call fails it
too. Covered: the suite has double-call and wrong-state negative tests for
every lifecycle transition.

### 4.3 Resolver drains via emergency withdraw unilaterally

**Stopped on-chain.** emergency_withdraw requires both admin and resolver auth,
and rejects an admin or resolver belonging to a different event, a non-existent
event, a zero or negative amount, and an amount above the reward. All eight
paths have named tests, including
test_emergency_withdraw_fails_with_admin_signature_only and
test_emergency_withdraw_fails_with_resolver_signature_only.

### 4.4 Judge releases a split the organizer never declared

**NOT stopped on-chain — enforced in the Go service only.** This is the
scenario the issue asks to name explicitly, and the code confirms it:
release_reward validates that every winner.amount > 0, that
winners.len() <= MAX_WINNERS, and that the amounts **sum** to event.reward. It
holds no record of the organizer's declared per-position breakdown, so any
partition of the reward across up to 25 positive amounts is equally valid to
the contract. A judge submitting a different split than the one declared at
creation is not doing anything the contract can detect.

The declared breakdown is therefore an asset that exists off-chain only (#54,
U01b). The compensating control lives in the Go service (per #66, U05), and it
is a control the on-chain audit cannot see. **No contract test covers this, and
none can** — there is nothing on-chain to assert against. If the organizer's
declared split is meant to be binding, it has to become contract state; that is
a design change, not a test (Scope-Out, section 7).

### 4.5 Anyone forces an event to expire

**Allowed by design, with bounds.** expire_event has **no require_auth call**:
any address can invoke it. It is bounded to the states Created, WaitingForStart
and InProgress, and asserts that the ledger timestamp is at or past
event.deadline; it then cancels the event and returns the reward to the
organizer's free balance. The effect is pro-organizer — a stuck event can
always be unwound by anyone — but it is a real permissionless transition: a
third party can end an event the moment its deadline passes, foreclosing any
later release. That is the intended fallback rather than a defect, and it is
recorded here because a reader should not have to infer permissionlessness
from the absence of a require_auth line.

### 4.6 Organizer and resolver collude after the deadline

**Not prevented.** Both signatures are sufficient for emergency_withdraw by
design: ADR-003 routes a silent judge through the resolver. The mitigations are
transparency — both identities are published before the event starts — plus the
amount bound, which is never more than the event's reward. Naming it because
dual authorization is not the same as preventing collusion: the trust
assumption is that the resolver is a party separate from the organizer, which is
why ADR-006 recommends Astrea's own resolver be a multisig rather than a single
key.

### 4.7 Reentrancy through the token contract

**Mitigated structurally.** Every value-moving path writes its state before the
external token transfer: release_reward flips the event to Ended and persists
before paying, and withdraw_funds decrements the balance before transferring.
A reentrant call therefore observes already-updated state. Soroban's host
additionally rejects reentry into an active frame, and release_reward pays every
winner in one atomic call (ADR-002), so a failure reverts the whole release
rather than leaving a partial payout.

## 5. Mitigations and confidence

Every mitigation carries one of the three confidence levels the issue defines.
The declared-breakdown case is the worked example of the middle one.

| Scenario | Mitigation | Confidence |
| --- | --- | --- |
| 4.1 Organizer releases | No such function exists; release_reward requires the judge identity | **Enforced on-chain** (verified K01/K02 on testnet) |
| 4.2 Double or early release | State assertion InProgress plus the flip to Ended | **Enforced on-chain** |
| 4.3 Unilateral resolver withdraw | Dual require_auth, cross-event identity checks, amount bound | **Enforced on-chain** |
| 4.4 Judge pays a different split | None on-chain — release_reward sees only a sum. The Go service checks the split against the organizer's declaration before submitting | **Enforced in Go service only** (model case) |
| 4.5 Forced expiry | Bounded by state and by the deadline; effect is a refund to the organizer, not a misdirection of funds | **Enforced on-chain**, permissionless by design |
| 4.6 Organizer and resolver collude | Published identities; resolver recommended as a multisig; amount never exceeds the reward | **Not yet enforced** (social and procedural) |
| 4.7 Reentrancy | State written before external calls; host rejects reentry; single atomic payout | **Enforced on-chain** |

Two entries deserve a sentence beyond the table.

**4.4 is the only place where a reader could reasonably believe the contract
enforces something it does not.** Every other row is a claim the contract makes
good on its own. This one is a claim the contract is silent about, and the
silence is invisible from the contract's interface — release_reward looks like
it validates the payout, and it does, but only its total.

**4.6 is not a bug and is not fixable by more code.** It is the trust a
designated resolver inherently carries. Recording it as "not yet enforced"
rather than "enforced" is the honest classification; the mitigation is who is
chosen for the role and how their key is held.

## 6. What is not implemented yet

Naming this explicitly, because the ADRs describe a design the code does not
fully have, and a threat model that assumed it would be wrong:

- **dispute / resolve_dispute do not exist.** docs/architecture.md records the
  mapping and issue #22 tracks the work. ADR-003's "judge goes silent, the
  resolver executes the release on the judge's behalf" is therefore
  **aspirational, not implemented**: today a silent judge has no resolution
  path, and emergency_withdraw (organizer plus resolver) is the only
  dual-signature mechanism that exists.
- **Independently payable milestones do not exist.** ADR-002 is recorded as
  superseded by what was actually built: a single reward i128 per event, with
  winners as shares released together. The consequence for this threat model is
  that "a dispute on one prize blocking another" is not a scenario the current
  data model can express — there is only ever one payout event to block.
- **Multi-judge panels are a multisig account, not a contract feature.**
  Deferred to Phase 3 (U05). Until then the contract sees a single
  approver/release_signer address.

## 7. Out of scope

Per the issue: fixing anything found here is out of scope, and gaps are to be
named rather than patched. Also out of scope is formal verification (L02),
which this document can inform but does not replace.

Gaps named in this document and where they are tracked:

| Gap | Tracked by |
| --- | --- |
| Judge can release a split the organizer never declared | #54 (U01b) and #66 (U05) — the enforcement is designed to live in the Go service |
| Silent judge has no on-chain resolution path | #22 (E01d — dispute and resolve_dispute) |
| Resolver, organizer collusion | No issue. Structural to the resolver role; ADR-006's multisig recommendation is the control |
| Permissionless expire_event | No issue. Intended behaviour, documented here |

## 8. Test coverage against these scenarios

Cross-referenced against the contract's suite on develop. The issue anticipated
this cutting both ways, so gaps are listed rather than summarised.

| Scenario | Coverage |
| --- | --- |
| 4.1 Organizer releases | Covered, multiple suites |
| 4.2 Double or early release | Covered, plus wrong-state paths per transition |
| 4.3 Unilateral resolver withdraw | Covered, all eight rejection paths named |
| 4.4 Judge pays a different split | **No coverage possible on-chain.** The Go-service check has no contract test by construction |
| 4.5 Forced expiry | Partially: the state and deadline assertions are reachable, but the permissionlessness itself (that any address may call it) is not asserted by a test |
| 4.6 Collusion | Not applicable — no code to test |
| 4.7 Reentrancy | Covered indirectly by the atomicity of a single release; there is no malicious-token test in this suite |

Section 4.5 is the one concrete test gap this document surfaces: nothing asserts
that expire_event is callable by an address with no relationship to the event,
which is the property that makes the fallback work when an organizer has gone
quiet. That is a small, addable test rather than a design question.
