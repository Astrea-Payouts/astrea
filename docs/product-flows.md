# Astrea — Product Flows

This document defines the roles, core user journeys, and the escrow lifecycle. It is the product contract the build plan implements.

## Roles

| Role | Who they are | What they can do |
| --- | --- | --- |
| **Organizer** | Hackathon host, community lead, bounty sponsor | Creates events, defines prizes, funds the escrow, manages judges |
| **Judge** | Trusted reviewer appointed by the organizer | Reviews submissions, approves and releases prizes |
| **Participant** | Builder competing in the event | Registers wallet, submits entry, receives prize on win |
| **Dispute Resolver** | Neutral third party defined at escrow creation | Resolves disputes (e.g., absent judges, contested results) |

Escrow role mapping:

- Organizer → funder (not in the payout path — see ADR-003). No function callable by the organizer moves escrowed funds anywhere.
- Judges → `approver` and `release_signer`. For a panel of multiple judges, that address is a Stellar multisig account they co-sign (see ADR-003); approval and release are two separate judge-signed transactions. The winner's address is supplied directly at release — the contract pays the winner in the same transaction the judge releases, no intermediate step.
- Winner wallet → receives the release directly from the escrow contract.
- Dispute resolver → resolves disputes, published on the event page before the event starts.

## Flow 1 — Organizer creates an event

1. Organizer connects a Stellar wallet (Stellar Wallets Kit).
2. Creates event: name, description, dates, submission rules.
3. Defines prizes: e.g., 1st = 1,000 USDC, 2nd = 500 USDC, 3rd = 250 USDC. Each prize becomes one escrow milestone.
4. Appoints judges (wallet addresses + display names). If more than one judge, they set up a shared Stellar multisig account (M-of-N) that becomes the on-chain `approver`/`release_signer` — see ADR-003.
5. Reviews the escrow summary → signs the deploy transaction (unsigned XDR built server-side, signed in wallet).
6. Event is created in `DRAFT` state with the escrow's `contractId` attached.

## Flow 2 — Organizer funds the prize pool

1. From the event dashboard, organizer starts the funding flow.
2. For each prize, the UI shows the exact amount that will be locked — the contract has no built-in fee, so the funded amount equals the winner's eventual payout exactly.
3. Backend builds the fund transaction for the total (sum of prizes).
4. Organizer signs; transaction submitted; state moves to `FUNDED` once confirmed on-chain.
5. The public event page now shows a **"Prizes verified on-chain"** badge with the contract link. The event can be published (`LIVE`).

An event cannot go `LIVE` unless the escrow balance equals the sum of prizes. That's the core product guarantee, and it's exact — no fee disclosure needed, because there isn't one to disclose.

## Flow 3 — Participants join and submit

1. Participant connects wallet and registers for the event.
2. System checks the wallet has a **USDC trustline**; if missing, guides the user to create it now — not at payout time.
3. Participant submits their entry (link to repo/demo) before the deadline.
4. Submissions are visible to judges when the event closes (`JUDGING`).

## Flow 4 — Judging and payout

1. Judges review submissions and select winners per prize.
2. Winner assignment re-validates the winner wallet + trustline.
3. Judge signs two transactions per decided prize — **approve**, then **release** (winner's address supplied as an argument to `release`). The organizer is not in this path (ADR-003).
4. **Release**: USDC lands directly in the winner's wallet — the contract pays the winner in the same transaction the judge signs, no intermediate custody, no second signing step.
5. Event page updates: winner, amount, transaction hash, explorer link. When all prizes are released the event is `COMPLETED`.

## Flow 5 — Dispute

Triggers: a judge is unresponsive past a deadline, a result is contested, or the organizer attempts to abandon the event after funding.

1. Any involved party — organizer, judge, or the winner themselves — opens a dispute on the affected milestone. The dispute resolver cannot open a dispute on their own escrow.
2. Milestone enters `DISPUTED`; the normal approve/release path (Flow 4) is bypassed for that prize.
3. The dispute resolver reviews the situation and resolves it directly — either refunding the organizer or paying a named recipient (typically the winner) — in one transaction. This is the real recourse when a judge goes silent: the winner doesn't need the judge to do anything.
4. Resolution is recorded with its transaction hash.

The dispute resolver must be a genuinely different person from the judge for this to work as a safety net — a judge who is also their own resolver has no one left to override them if they go silent or act in bad faith.

## Event state machine

```
DRAFT ──deploy escrow──▶ CREATED ──fund confirmed──▶ FUNDED ──publish──▶ LIVE
LIVE ──deadline──▶ JUDGING ──all prizes released──▶ COMPLETED
JUDGING ──dispute opened──▶ (milestone-level DISPUTED, event stays JUDGING)
Any funded state ──cancel + refund flow──▶ CANCELLED
```

Prize (milestone) states: `PENDING → ASSIGNED → APPROVED → RELEASED` with `DISPUTED` as a side-state blocking release. `RELEASED` means the winner has been paid directly and confirmed on-chain — there's no separate forwarding state to track. All transitions are validated server-side; money-moving transitions require an on-chain confirmation before the mirror state advances.

## Non-goals for the MVP

- Mainnet operation (testnet only until the hardening phase).
- Fiat on/off ramps.
- Multi-asset prizes (USDC only).
- Automated judging or scoring.
