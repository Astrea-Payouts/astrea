# Astrea — Product Flows

This document defines the roles, core user journeys, and the escrow lifecycle. It is the product contract the build plan implements.

## Roles

| Role | Who they are | What they can do |
| --- | --- | --- |
| **Organizer** | Hackathon host, community lead, bounty sponsor | Creates events, defines prizes, funds the escrow, manages judges |
| **Judge** | Trusted reviewer appointed by the organizer | Reviews submissions, approves winners (drives milestone approval) |
| **Participant** | Builder competing in the event | Registers wallet, submits entry, receives prize on win |
| **Dispute Resolver** | Neutral third party defined at escrow creation | Resolves disputes (e.g., absent judges, contested results) |

Escrow role mapping (Trustless Work multi-release):

- Organizer → funder / platform (NOT in the payout path — see ADR-003)
- Judges → `approver`, `releaseSigner`, **and milestone `receiver`**. A Trustless Work escrow has exactly **one** address per role — for a panel of multiple judges, that address is a Stellar multisig account they co-sign (see ADR-003); approval and release are two separate judge-signed transactions, not one combined step. The judge is the milestone receiver because the winner isn't known at deploy time and Trustless Work does not allow changing a receiver afterward — the judge forwards the released funds to the winner in a second, ordinary Stellar payment (see ADR-007)
- Winner wallet → receives a direct Stellar payment from the judge immediately after release, not the milestone `receiver` itself
- Dispute resolver → dispute resolver (published on the event page before the event starts)

## Flow 1 — Organizer creates an event

1. Organizer connects a Stellar wallet (Stellar Wallets Kit).
2. Creates event: name, description, dates, submission rules.
3. Defines prizes: e.g., 1st = 1,000 USDC, 2nd = 500 USDC, 3rd = 250 USDC. Each prize becomes one escrow milestone.
4. Appoints judges (wallet addresses + display names). If more than one judge, they set up a shared Stellar multisig account (M-of-N) that becomes the on-chain `approver`/`releaseSigner` — see ADR-003.
5. Reviews the escrow summary → signs the deploy transaction (unsigned XDR built server-side, signed in wallet).
6. Event is created in `DRAFT` state with escrow `contractId` attached.

## Flow 2 — Organizer funds the prize pool

1. From the event dashboard, organizer starts the funding flow.
2. For each prize, the UI shows the fee math up front: configured amount, the exact net amount the winner will receive after Trustless Work's 0.3% fee (plus Astrea's own `platformFee`, 0% today), and an optional **"cover the fee so the winner gets the full amount"** toggle. If the organizer opts in, the funded amount is grossed up (`prize ÷ (1 - 0.003 - platformFee)`) so the *net* received equals the advertised prize exactly — this is the organizer's own informed choice, not Astrea inflating a number automatically (see ADR-005).
3. Server builds fund XDR for the total amount (sum of prizes, or the fee-covered totals for any prize where the organizer opted in).
4. Organizer signs; transaction submitted; state moves to `FUNDED` once confirmed on-chain.
5. The public event page now shows a **"Prizes verified on-chain"** badge with the contract link. The event can be published (`LIVE`).

An event cannot go `LIVE` unless the escrow balance equals the sum of prizes (fee-covered or not, per prize). This is the core product guarantee — with one honest caveat where the organizer didn't cover the fee: Trustless Work deducts a fixed **0.3% protocol fee** at release (confirmed in their whitepaper and in the K01 spike; see ADR-005). The event page discloses this plainly per prize: the configured amount, whether the fee is covered, and the exact amount the winner will receive — that number is always what actually lands in the winner's wallet, never a rounder number that doesn't match reality.

## Flow 3 — Participants join and submit

1. Participant connects wallet and registers for the event.
2. System checks the wallet has a **USDC trustline**; if missing, guides the user to create it now — not at payout time.
3. Participant submits their entry (link to repo/demo) before the deadline.
4. Submissions are visible to judges when the event closes (`JUDGING`).

## Flow 4 — Judging and payout

1. Judges review submissions and select winners per prize.
2. Winner assignment re-validates the winner wallet + trustline.
3. Judge signs three separate transactions per decided prize — **approve**, then **release** (no combined step exists on the real API), then **forward**. The organizer is not in this path (ADR-003).
4. **Approve + release**: USDC lands in the judge's own wallet (net of Trustless Work's 0.3% fee) — the judge is the milestone's on-chain receiver because the winner wasn't known when the escrow was deployed and that can't be changed afterward (ADR-007).
5. **Forward**: the same signing flow immediately prompts the judge to send the exact received amount (computed, not typed) to the winner via a plain Stellar payment. USDC lands in the winner's wallet seconds later.
6. Event page updates: winner, amount, both transaction hashes (release + forward), explorer links. When all prizes are released and forwarded the event is `COMPLETED`.

## Flow 5 — Dispute

Triggers: a judge is unresponsive past a deadline, a result is contested, or the organizer attempts to abandon the event after funding.

1. Any involved party — organizer, judge, **or the winner themselves** — opens a dispute on the affected milestone (verified: all three can do this independently; the dispute resolver cannot open a dispute on their own escrow).
2. Milestone enters `DISPUTED`; the normal approve/release/forward path (Flow 4) is bypassed for that prize.
3. The dispute resolver reviews the situation and resolves it directly to the correct recipient (typically the winner) via `resolve-milestone-dispute` — this pays straight from the escrow to that address in one transaction, with **no forwarding step and no funds ever touching the judge's wallet**. This is the real recourse when a judge goes silent: the winner doesn't need the judge to do anything.
4. Resolution is recorded with its transaction hash.

The dispute resolver must be a genuinely different person from the judge for this to work as a safety net — merging the two roles is technically possible but was deliberately rejected (see ADR-007): a judge who is also their own resolver has no one left to override them if they go silent or act in bad faith.

## Event state machine

```
DRAFT ──deploy escrow──▶ CREATED ──fund confirmed──▶ FUNDED ──publish──▶ LIVE
LIVE ──deadline──▶ JUDGING ──all prizes released──▶ COMPLETED
JUDGING ──dispute opened──▶ (milestone-level DISPUTED, event stays JUDGING)
Any funded state ──cancel + refund flow──▶ CANCELLED
```

Prize (milestone) states: `PENDING → ASSIGNED → APPROVED → RELEASED → PAID_OUT` with `DISPUTED` as a side-state blocking release. `RELEASED` means funds landed in the judge's wallet; `PAID_OUT` means the judge's forward payment to the winner is confirmed on-chain (ADR-007) — these are distinct, both reconciler-tracked states, not one step. All transitions are validated server-side; money-moving transitions require an on-chain confirmation before the mirror state advances.

## Non-goals for the MVP

- Mainnet operation (testnet only until the hardening phase).
- Fiat on/off ramps.
- Multi-asset prizes (USDC only).
- Automated judging or scoring.
