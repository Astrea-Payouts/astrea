# Astrea — Business Model Canvas (draft)

Status: draft, September 2026. Written to move Astrea from BRL 2 to BRL 3 on the KTH Business Readiness Level scale. Everything below is a hypothesis until organizers pay for it on mainnet; the parts that are already true in code are marked as such.

Companion documents: [competitive-analysis.md](competitive-analysis.md), [market-sizing.md](market-sizing.md).

## Summary

Organizers pay Astrea a one-time go-live fee of 0.5 % of the prize pool when an event goes live. In exchange, the pool is locked in an on-chain escrow before anyone commits time to the event, Astrea stands as the default dispute resolver, and winners are paid in USDC by the judge in seconds. Participants never pay.

Worked example, the same numbers the MVP uses today: an organizer creates an event with a 1,000 USDC pool. The pool is reserved from their escrow balance at creation. When they publish the event, the contract charges 5 USDC (0.5 %) from their free balance to Astrea's treasury. The 1,000 USDC stays whole for the winners, so the organizer deposits 1,005 USDC in total.

## The canvas

### 1. Customer segments

The payer is the organizer. The participant is the user whose trust the product exists to earn, but does not pay.

| Segment | Why they would care | Priority |
| --- | --- | --- |
| Ecosystem foundations and grant programs running hackathons (Stellar Development Foundation, SCF-funded communities, other L1/L2 foundations) | They already pay prizes in stablecoins, need a public record of where the money went, and are judged on builder trust | First |
| Web3 communities and DAOs running bounties and challenges | Recurring small pools, often paid by hand from a multisig | First |
| University and student hackathon organizers | Small pools, sponsors who pay late, participants with the least leverage | Second |
| Companies running public developer challenges | Larger pools, but they need fiat rails and tax paperwork Astrea does not offer yet | Later |

### 2. Value propositions

For organizers:

- A credible prize announcement. The event page links to the escrow, so "10,000 USDC in prizes" is checkable before launch instead of a promise.
- No payout operations. No collecting bank details, no batch transfers, no chasing forms. The judge releases, the contract pays the winner's wallet.
- A neutral fallback. If judges disappear or a result is contested, a dispute resolver named before launch settles it on-chain.
- Cost known up front. The fee is a fixed share of the pool, quoted on-chain (`quote_go_live_fee`) before the organizer signs.

For participants:

- Proof the prize exists before they spend a weekend on it.
- Payment in seconds after release, not weeks. For comparison, Devpost states its own prize fulfillment "can take up to 60 days from receipt of paperwork" ([Devpost Help Center](https://help.devpost.com/article/114-how-to-claim-your-hackathon-cash-prize-winners-only)).
- A public transaction hash for every payment.

### 3. Channels

- Stellar ecosystem first: SCF, Stellar community events, Stellar-native builders on GrantFox and DoraHacks. This is where USDC wallets and trustlines already exist, so onboarding costs the least.
- Direct outreach to organizers of hackathons that already pay in stablecoins.
- The open-source repository itself. The contract, the testnet proof and the architecture decisions are public, which is the argument for trust.
- University hackathon clubs, once the organizer flow is stable on mainnet.

### 4. Customer relationships

- Self-serve for the event lifecycle: create, fund, publish, judge, release.
- Hands-on onboarding for the first organizers (set up wallets, trustlines, judge multisig), because early events are also the customer-validation step for BRL 5.
- Astrea as default dispute resolver, disclosed on the event page before launch. That role is what the fee pays for, not only the software.

### 5. Revenue streams

In code today (testnet):

- Go-live fee charged once, at `set_event_in_progress`, from the organizer's free wallet balance, never out of the reserved prize (`smart-contracts/astrea/contracts/event-escrow/src/lifecycle.rs`).
- Default rate 0.5 % (`DEFAULT_FEE_BPS = 50`). The emergency admin can change it with `set_fee_bps`, up to a hard ceiling of 5 % (`MAX_FEE_BPS = 500`) that can only be raised by redeploying the contract (`governance.rs`). Organizers can verify that ceiling themselves.
- Non-refundable once charged: cancellation, dispute resolution and expiry return the prize, not the fee.
- No fee at release, no fee to participants.
- Verified on testnet (USDC smoke test against the current deployment, 2026-09-14): three go-lives charged 50,000, 25,000 and 30,000 units (0.5 % of each reward, in USDC's 7-decimal units) and the treasury went from 0 to exactly 0.0105 USDC ([event-escrow README](../../smart-contracts/astrea/contracts/event-escrow/README.md)).

Hypotheses, not built, listed so they can be tested rather than assumed:

- Rate by segment within the 5 % ceiling (for example, a higher rate for small pools where 0.5 % does not cover onboarding).
- Paid services around the event: judge panel setup, custom event pages, reporting for sponsors.
- Yield or float income is explicitly out: funds sit in the organizer's ledger and Astrea never holds them.

The honest read on the numbers is in [market-sizing.md](market-sizing.md): at 0.5 %, the fee alone needs a large volume of pools before it pays for the founders' time. Pricing is the main open question of this canvas.

### 6. Key resources

- The `EventEscrow` Soroban contract, one shared instance for every organizer (ADR-006).
- The Go service that builds and submits every transaction without holding keys (`services/core-go`).
- The web app (`apps/web`) with wallet connection through Stellar Wallets Kit.
- The public testnet proof (E03): seven scenarios, including two attacks rejected on-chain.
- Two co-founders, Christopher Lamberti and Dereck Monge, covering contract, backend and frontend between them. No hires planned until usage justifies them.

### 7. Key activities

- Keeping the money path correct: contract, Go build/submit, state machines on both sides.
- Security review before mainnet (task L01), funded through the Soroban Audit Bank if Astrea gets an SCF award (ADR-001).
- Acting as dispute resolver for events that do not name a third party.
- Onboarding the first organizers and measuring what they actually do.

### 8. Key partners

- Stellar Development Foundation and the Stellar Community Fund: grants, the Soroban Audit Bank, and the first organizers.
- Circle, as issuer of USDC.
- Wallet providers integrated through Stellar Wallets Kit: Freighter, Albedo, xBull, LOBSTR.
- Hosting and data: Vercel (web and Go service), Supabase (Postgres mirror).
- Later, anchors for fiat off-ramps, which the MVP leaves out on purpose.

### 9. Cost structure

- People: the two co-founders' time is the dominant cost. There are no salaries today.
- Security audit before mainnet, expected to be covered by the Audit Bank if the SCF award comes through; otherwise the largest single cost.
- Hosting: Vercel and Supabase. Scales with usage, not with pool size.
- On-chain fees: Stellar network fees per transaction, paid by the signer of each transaction, not by Astrea.
- Dispute handling: operator time per contested event.

Because Astrea never custodies funds, there is no money-transmission float to fund and no custody insurance in the cost base. Regulatory review for mainnet is still an open item.

## What BRL 3 needs from here

BRL 3 asks for a draft canvas, a view of competitors and a first market estimate; this set covers those three. BRL 4 adds quantified revenues and costs plus first projections of economic viability; those live in [financial-projections.md](financial-projections.md). BRL 5 tests the model against customers; [customer-interviews.md](customer-interviews.md) has the screener, scripts and scoring thresholds. The riskiest assumptions to test first:

1. Organizers see a pre-funded pool as worth paying for, rather than a nice-to-have. Test: interviews with at least 10 organizers who have paid prizes in the last year.
2. 0.5 % is a price organizers accept without negotiation, and whether small-pool organizers would pay more for onboarding help.
3. Organizers are willing to have Astrea (or a named third party) as dispute resolver.
4. Participants choose events because the pool is verifiable. Test: compare registrations on escrowed and non-escrowed events once there are enough of both.
