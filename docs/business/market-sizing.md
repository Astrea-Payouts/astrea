# Astrea — Market potential estimate (draft)

Status: draft, September 2026. A bottom-up estimate built from public figures plus explicit assumptions. Every assumption is labelled; replace it with real data as soon as organizer interviews or mainnet events produce some. Companion to [business-model-canvas.md](business-model-canvas.md) and [competitive-analysis.md](competitive-analysis.md).

## What is being sized

Astrea earns 0.5 % of each prize pool at go-live. The market is therefore **prize money that passes through hackathons, bounties and community challenges per year**, and Astrea's revenue is 0.5 % of whatever share of it runs through the contract.

Published "hackathon management software" market reports disagree widely: [Business Research Insights](https://www.businessresearchinsights.com/market-reports/hackathon-management-software-market-124877) puts it at about USD 1.37 billion in 2026, while [BlueWeave](https://www.blueweaveconsulting.com/report/global-hackathon-management-software-market-report) forecast USD 292.2 million for 2026. Either figure measures spending on hosting and innovation-management tools, mostly corporate and internal, not prize money. It is not used below.

## Public data points

| Figure | Source |
| --- | --- |
| 1,200+ hackathons on Devpost in 2023, 1.4M new users | [Devpost 2023 year in review](https://info.devpost.com/blog/devpost-year-in-review-2023) |
| 184 hackathons and programs, 150,000+ hackers in MLH's 2025 season; 200+ planned for 2026 | [MLH](https://blog.mlh.com/welcome-to-the-2026-hackathon-season-07-08-2025) |
| Devpost's suggested range for an online hackathon: $15,000–$100,000+ in prizes | [Devpost Help Center](https://help.devpost.com/article/74-developing-prize-structures) |
| DoraHacks: $20M+ in grants and contributions to 3,000+ projects (cumulative) | [DoraHacks](https://dorahacks.io/discussion/1555583) |
| Stellar Build Better Hackathon 2025: $25,000 USDC, 220 registered developers, 84 approved projects | [Stellar on X](https://x.com/StellarOrg/status/1903178248348987720), [DoraHacks](https://dorahacks.io/hackathon/build-on-stellar/detail) |
| Stellar Hacks: Real-World ZK 2026: $10,000 in XLM | [DoraHacks](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) |
| Casa Stellar hackathon at DevConnect Argentina 2025: $15,000 | [Stellar](https://stellar.org/community/events/stellar-at-devconnect-argentina) |

## Assumptions

| # | Assumption | Low | Mid | High | Basis |
| --- | --- | --- | --- | --- | --- |
| A1 | Hackathons with a cash prize per year, worldwide | 2,000 | 3,000 | 5,000 | Devpost alone had 1,200+ in 2023; adds DoraHacks, Unstop, web3-native platforms and independent events; MLH overlaps heavily with Devpost |
| A2 | Average cash prize pool per hackathon (USD) | 5,000 | 10,000 | 20,000 | Student events are often below $5k; corporate and foundation online events sit in Devpost's $15k–$100k range |
| A3 | Share of those events already paying in crypto or stablecoins | 15 % | 25 % | 35 % | Guess; no public breakdown found. Needs validation |
| A4 | Stellar-ecosystem prize money per year (USD): SDF hackathons plus SCF-funded community events, bounties excluded | 75,000 | 150,000 | 300,000 | 3–5 SDF-level events at $10k–$25k (examples above) plus a few dozen smaller community events |
| A5 | Share of Stellar-ecosystem prize money Astrea captures in its first 24 months on mainnet | 10 % | 30 % | 50 % | Guess; depends on SDF and community organizers adopting it |

## Estimate

Revenue is the pool times 0.5 %.

| Layer | Definition | Prize money per year (low / mid / high) | Astrea revenue at 0.5 % (low / mid / high) |
| --- | --- | --- | --- |
| **TAM** | All hackathon cash prizes worldwide (A1 × A2) | $10M / $30M / $100M | $50k / $150k / $500k |
| **SAM** | Events already paying in crypto or stablecoins (TAM × A3) | $1.5M / $7.5M / $35M | $7.5k / $37.5k / $175k |
| **SOM** | Stellar-ecosystem prize money Astrea captures (A4 × A5) | $7.5k / $45k / $150k | $37.50 / $225 / $750 |

Bounties and recurring challenges are left out of the table because there is no reliable public total for them. They are the most likely source of upside: they are smaller than hackathons but far more frequent.

## What the numbers say

**At 0.5 %, the go-live fee validates willingness to pay; it does not yet pay for the founders' time.** Two illustrations:

- The mid-case SOM is about $45,000 of prizes a year, which is $225 in fees.
- For one of the two co-founders to earn $40,000 a year from Astrea (an assumption for illustration; neither is paid today), Astrea would need $8M a year in pools, about a quarter of the entire mid-case TAM and more than the mid-case SAM.

That is not a reason to change the fee today. On testnet and early mainnet the fee's job is to prove that organizers accept paying for a locked pool at all. It does set the questions this model has to answer before BRL 4:

1. **Volume.** Can Astrea reach bounties and recurring community challenges, not only hackathons? That is where the count of pools grows.
2. **Rate.** The contract already allows up to 5 % without a redeploy. At 2 %, the mid-case SAM is worth $150k a year; at 5 %, $375k. Whether organizers pay that for pre-launch locking plus a dispute resolver is the pricing test.
3. **Services.** Onboarding, judge-panel setup and sponsor reporting may be worth more to small organizers than a percentage.
4. **Non-dilutive funding.** Until volume exists, building and auditing are expected to be funded by grants (SCF, and the Soroban Audit Bank for the security review), as in ADR-001.

## How to firm this up

- Replace A1 and A2 with a count from a public dataset of hackathons with published prize amounts (Devpost and DoraHacks listings can be scraped or sampled).
- Replace A3 with the share of sampled events whose prizes are paid in crypto.
- Replace A4 with the actual list of Stellar-ecosystem events and pools from the last 12 months.
- Replace A5 with committed organizers once mainnet is live.
