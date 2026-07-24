# K01 — Trustless Work testnet spike

**Status: complete, 2026-07-24.** End-to-end multi-release escrow lifecycle run against the Trustless Work dev API on Stellar testnet, verifying the role model behind **ADR-003** (judge as sole payout signer; organizer out of the payout path).

Result contract: `CACTMEF4DADZI6AVIZPZ43U4QTI4SFFUJYBFRY3YKHXYWQYOSAXP4E4N`. Full run log in `.findings.json`.

## ⚠️ The public docs were wrong — trust the live API

`docs.trustlesswork.com` describes a `v2` REST shape (`/escrow/multi-release/v2/deploy`, array-based `roles.approvers[]`/`roles.releaseSigners[]`, batch `milestoneIndexes`) that **does not exist** on the actual dev API — every one of those paths 404s. The real, current contract lives at `GET https://dev.api.trustlesswork.com/docs-json` (a live OpenAPI/Swagger spec). Whenever an endpoint call fails unexpectedly, re-derive the payload from that spec, not from the prose docs.

## What it verifies — results

| # | Check | Result |
| --- | --- | --- |
| 1 | Deploy multi-release escrow (3 milestones = 3 prizes, judge as sole `approver` and `releaseSigner`) | ✅ PASS — `contractId` returned via `/helper/send-transaction` after submitting the signed deploy tx |
| 2 | Organizer funds 20 USDC | ✅ PASS |
| 3 | **NEG-1**: organizer impersonates `disputeResolver` on `withdraw-remaining-funds` | ✅ rejected — `"Only the dispute resolver can execute this function"` (HTTP 400) |
| 4 | **NEG-2**: judge calls `release-milestone-funds` before approving | ✅ rejected — `"The milestone must be completed to release funds"` (HTTP 400) |
| 5 | Judge approves milestone 0 | ✅ PASS |
| 6 | Judge releases milestone 0 | ⚠️ PASS with a finding — winner received **11.964 USDC**, not the configured 12.000 USDC (see below) |

Every outcome — including the expected failures — is recorded in `.findings.json`. `UNEXPECTED-PASS` on a NEG check would mean an ADR assumption is broken; neither NEG check produced one.

## Findings folded into the docs

1. **ADR-003 confirmed, and strengthened.** The organizer cannot withdraw funds under any tested path — not just "shouldn't," the API rejects it at the role-check level. See [docs/architecture.md](../../docs/architecture.md#adr-003--organizer-is-not-in-the-payout-path).
2. **No combined approve-and-release endpoint** — confirmed against the live spec, not just inferred from docs. Approve and release are two separate signed transactions. Both product-flows.md and architecture.md were corrected (they previously described a single combined step).
3. **Roles are singular, not arrays.** One `approver` address, one `releaseSigner` address per escrow — not a list. This has a real product implication for multi-judge panels (Stellar multisig account as the on-chain signer) — documented in ADR-003.
4. **New: a ~0.3% protocol fee applies even with `platformFee: 0`.** Undocumented on the public docs site; single data point so far. Tracked as **ADR-005** (open finding, not a closed decision) — needs re-testing with a different amount and confirmation from Trustless Work before Phase 2 locks in the funding-guarantee logic.

## How to run (reproduce)

```bash
npm install
cp .env.example .env       # add your TW_API_KEY (testnet, from https://dapp.trustlesswork.com)

npm run setup               # creates 4 testnet accounts + USDC trustlines → .accounts.json
# manual step: send testnet USDC to the organizer address printed by setup
#   faucet: https://faucet.circle.com — select "Stellar Testnet" (20 USDC / request / 2h limit,
#   which is why the spike's prizes total exactly 20 USDC: 12 + 5 + 3)

npm run spike                # runs the 6 checks → .findings.json
```

Requirements: Node.js 20+, a Trustless Work testnet API key.

`.env`, `.accounts.json`, and `.findings.json` contain testnet-only secrets/results; the future repo's `.gitignore` must exclude them.

## Next step

K01 is done. Per the build plan, **K02** (fold findings into ADRs) is now also done as part of this run — see the corrected ADR-003 and new ADR-005 in [docs/architecture.md](../../docs/architecture.md). Before starting **S01** (repo scaffold), resolve the ADR-005 open question (confirm the fee rate) in the Trustless Work / SCF Discord.
