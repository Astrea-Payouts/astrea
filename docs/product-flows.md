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
- Judges → `approver` and `releaseSigner`. A Trustless Work escrow has exactly **one** address per role — for a panel of multiple judges, that address is a Stellar multisig account they co-sign (see ADR-003); approval and release are two separate judge-signed transactions, not one combined step
- Winner wallet → receiver (per milestone)
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
2. Server builds fund XDR for the total prize amount (USDC).
3. Organizer signs; transaction submitted; state moves to `FUNDED` once confirmed on-chain.
4. The public event page now shows a **"Prizes verified on-chain"** badge with the contract link. The event can be published (`LIVE`).

An event cannot go `LIVE` unless the escrow balance equals the sum of prizes. This is the core product guarantee — with one honest caveat: Trustless Work deducts a fixed **0.3% protocol fee** at release (confirmed in their whitepaper and in the K01 spike; see ADR-005), on top of Astrea's own platform fee (0% for now). The event page discloses both plainly: the configured prize (what's locked) and the exact amount the winner will receive.

## Flow 3 — Participants join and submit

1. Participant connects wallet and registers for the event.
2. System checks the wallet has a **USDC trustline**; if missing, guides the user to create it now — not at payout time.
3. Participant submits their entry (link to repo/demo) before the deadline.
4. Submissions are visible to judges when the event closes (`JUDGING`).

## Flow 4 — Judging and payout

1. Judges review submissions and select winners per prize.
2. Winner assignment re-validates the winner wallet + trustline.
3. Judge signs two separate transactions per decided prize — **approve**, then **release** (no combined step exists on the real API). The organizer is not in this path (ADR-003).
4. USDC lands in the winner's wallet in seconds.
5. Event page updates: winner, amount, transaction hash, explorer link. When all prizes are released the event is `COMPLETED`.

## Flow 5 — Dispute

Triggers: a judge is unresponsive past a deadline, a result is contested, or the organizer attempts to abandon the event after funding.

1. Any involved party opens a dispute on a milestone.
2. Milestone enters `DISPUTED`; release is blocked.
3. The dispute resolver reviews evidence and signs a resolution (release to winner, or refund distribution).
4. Resolution is recorded with its transaction hash.

## Event state machine

```
DRAFT ──deploy escrow──▶ CREATED ──fund confirmed──▶ FUNDED ──publish──▶ LIVE
LIVE ──deadline──▶ JUDGING ──all prizes released──▶ COMPLETED
JUDGING ──dispute opened──▶ (milestone-level DISPUTED, event stays JUDGING)
Any funded state ──cancel + refund flow──▶ CANCELLED
```

Prize (milestone) states: `PENDING → ASSIGNED → APPROVED → RELEASED` with `DISPUTED` as a side-state blocking release. All transitions are validated server-side; money-moving transitions require an on-chain confirmation before the mirror state advances.

## Non-goals for the MVP

- Mainnet operation (testnet only until the hardening phase).
- Fiat on/off ramps.
- Multi-asset prizes (USDC only).
- Automated judging or scoring.
