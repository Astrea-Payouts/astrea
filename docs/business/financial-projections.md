# Astrea — Financial projections (draft)

Status: draft, September 2026. Written for KTH Business Readiness Level 4 ("first version of full business model in canvas, incl. revenues/costs; first projections to show economic viability and market potential"). Companion to [business-model-canvas.md](business-model-canvas.md), [market-sizing.md](market-sizing.md) and [competitive-analysis.md](competitive-analysis.md); reuses their TAM/SAM/SOM figures and assumptions A1–A5 without re-deriving them.

Every number below is one of four things: a figure pulled from a repo file (cited), a founder-provided figure (listed in the section below), a public price or fact fetched on 2026-09-24 (linked), or a labelled assumption with a low/mid/high range and a stated basis. Nothing here is tuned to look better than it is.

**Bottom line.** At the fee the contract charges today (0.5 % of the pool, once, at go-live) and the volume this model can currently justify (Stellar-only hackathons, per [market-sizing.md](market-sizing.md)'s SOM), Astrea's revenue is in the tens to low hundreds of dollars a year — it does not cover even the modest cash hosting bill at mainnet, let alone either founder's time. Raising the rate toward the contract's 5 % ceiling and/or adding paid services closes much of the cash-cost gap, but covering founder opportunity cost at any realistic rate requires volume an order of magnitude beyond the Stellar-only SOM — reaching into the broader multi-chain SAM that Astrea is not chasing yet. This is a pre-revenue project whose fee model is unproven, not a broken one; the next step is testing willingness to pay, not projecting harder.

## Founder-provided figures (2026-09-24)

- Team: two unpaid co-founders, Christopher Lamberti and Dereck Monge. No salaries, no hires planned until usage justifies them.
- Hosting today: $0/month (Vercel Hobby + Supabase Free, no custom domain).
- Founder time valued at $20/hour as an opportunity-cost proxy, not actual pay. Full-time reference point: ~166 hours/month per founder ≈ $3,320/month (founder-stated as "~$3,300/month").
- Part-time hours/month today is not founder-specified; modelled as a labelled assumption below (F2), since actual hours vary week to week.

## 1. Cost structure

### 1.1 Cash costs

| Item | Now (testnet) | At mainnet | Basis |
| --- | --- | --- | --- |
| Vercel (web + Go service hosting) | $0 — Hobby plan | $20/seat/month, Pro plan ([vercel.com/pricing](https://vercel.com/pricing), fetched 2026-09-24) | Not just a usage limit: Vercel's Hobby tier is for personal, non-commercial use, and charging a real fee at mainnet makes this a commercial project — Pro is required by Vercel's terms, not only by traffic |
| Supabase (Postgres mirror) | $0 — Free plan | $25/month base (includes $10 of compute credit, one Micro instance) ([supabase.com/pricing](https://supabase.com/pricing), fetched 2026-09-24) | Free-tier projects pause after 1 week of inactivity — unacceptable for a production database backing live escrow state, so Pro is a firm trigger at mainnet, not a judgment call |
| Custom domain | $0 — none owned | ~$12–20/year (F7, assumption: typical .com retail registration/renewal price; no specific registrar quote fetched) | Needed for ADR-007 (Resend can only send to arbitrary recipients from a verified custom domain with SPF/DKIM/DMARC) |
| Resend (notifications) | $0 — sandbox sender only | $0 while under 3,000 emails/month and 100/day (free tier); $20/month for 50,000 emails/month once volume passes that (Pro plan) ([resend.com/pricing](https://resend.com/pricing), fetched 2026-09-24) | F11: stays on free tier through low-mid organizer volume; the trigger point roughly tracks Scenario B (§4) volume |

**Monthly cash cost at mainnet** (F9/F10, labelled): low $46 (1 Vercel seat + Supabase base + domain) / mid $66 (2 Vercel seats + Supabase base + domain) / high $87 (2 Vercel seats + Supabase base + domain + Resend Pro), before any Supabase usage overage. Annualized: **$552 / $795 / $1,044**.

Both founders as active Vercel team seats is the mid/high assumption (F9); if only one manages infrastructure, the low case applies.

### 1.2 One-time cost: audit co-pay

Per `docs/contracts-build-plan.md`: the Soroban Audit Bank charges 5 % of the initial audit cost upfront, **fully refunded** if critical/high/medium findings are remediated within 20 business days of verification. It is only reachable after an SCF Build Award (the chain is SCF → Audit Bank → mainnet).

| | Low | Mid | High |
| --- | --- | --- | --- |
| F5 — Audit quote (assumption; no public Soroban-escrow audit quote on file) | $15,000 | $25,000 | $40,000 |
| F6 — 5 % co-pay (refundable) | $750 | $1,250 | $2,000 |

### 1.3 Founder opportunity cost (not cash)

| | Low | Mid | High |
| --- | --- | --- | --- |
| F2 — Part-time hours/month per founder (assumption; current reality, no fixed schedule) | 40 h | 60 h | 80 h |
| Part-time cost per founder/month ($20/h) | $800 | $1,200 | $1,600 |
| Part-time cost, both founders/month | $1,600 | $2,400 | $3,200 |
| Part-time cost, both founders/year | $19,200 | $28,800 | $38,400 |
| F3 — Full-time hours/month per founder (founder-stated) | 166 h | 166 h | 166 h |
| Full-time cost per founder/month | $3,320 | $3,320 | $3,320 |
| Full-time cost, both founders/month | $6,640 | $6,640 | $6,640 |
| Full-time cost, both founders/year | $79,680 | $79,680 | $79,680 |

Cash costs and opportunity costs are kept separate throughout this document; neither founder is actually paid today.

## 2. Unit economics per event

Revenue = pool × rate. Variable cost = hands-on onboarding time (wallets, trustlines, judge multisig) that [business-model-canvas.md](business-model-canvas.md) says early organizers get, valued at $20/h (F4, assumption on hours since no organizer has gone through it on mainnet yet).

**F4 — Onboarding hours per organizer:** low 1 h ($20) / mid 2 h ($40) / high 4 h ($80).

### Revenue by pool size and rate

| Pool | 0.5 % | 2 % | 5 % |
| --- | --- | --- | --- |
| $1,000 | $5 | $20 | $50 |
| $5,000 | $25 | $100 | $250 |
| $10,000 | $50 | $200 | $500 |
| $25,000 | $125 | $500 | $1,250 |

### Contribution margin (revenue − onboarding cost)

At **mid** onboarding cost ($40/event):

| Pool | 0.5 % | 2 % | 5 % |
| --- | --- | --- | --- |
| $1,000 | −$35 | −$20 | +$10 |
| $5,000 | −$15 | +$60 | +$210 |
| $10,000 | +$10 | +$160 | +$460 |
| $25,000 | +$85 | +$460 | +$1,210 |

**Where it turns positive:** break-even pool size = onboarding cost ÷ rate. At mid onboarding ($40): **$8,000** at 0.5 %, **$2,000** at 2 %, **$800** at 5 %. At low onboarding ($20) the thresholds halve ($4,000 / $1,000 / $400); at high onboarding ($80) they double ($16,000 / $4,000 / $1,600).

**Reading:** at the contract's default 0.5 % rate, an event needs a pool of roughly $8,000+ before Astrea's own onboarding time is covered — most of the pool sizes market-sizing.md's A2 assumption expects from student and small community events ($5,000 low case) fall short of that. This is the arithmetic behind the canvas's and market-sizing's own suggestion of a higher rate for small pools with onboarding bundled in (Scenario C, below).

## 3. Scenarios over 36 months

**Mainnet timing.** Per `docs/contracts-build-plan.md`, the chain is SCF Build Award → Soroban Audit Bank → mainnet, "on the order of half a year." All scenarios assume **no mainnet revenue in Quarters 1–2** (months 1–6): that period is SCF application, audit-bank readiness, and the audit itself. Mainnet go-live and the first real fee-paying events are assumed to land in **Quarter 3** (month 7).

**Ramp shape (shared assumption, all scenarios).** Volume does not jump to full run-rate at mainnet launch; it ramps toward the [market-sizing.md](market-sizing.md) A5 target ("Astrea captures its stated share of Stellar-ecosystem prize money within 24 months of mainnet") reaching full run-rate around month 28 (Quarter 10), then holding flat through Quarter 12:

| Quarter | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Q11 | Q12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Status | pre-mainnet | pre-mainnet | mainnet live | ramp | ramp | ramp | ramp | ramp | ramp | full run-rate | full | full |
| % of full run-rate | 0 % | 0 % | 10 % | 20 % | 35 % | 50 % | 65 % | 80 % | 90 % | 100 % | 100 % | 100 % |

### Scenario A — status quo: 0.5 %, Stellar hackathons only, SOM-driven

Assumptions: fee stays at the contract default (0.5 %); pool volume equals the SOM ramp above, using market-sizing's SOM figures ($7,500 / $45,000 / $150,000 per year at full run-rate, low/mid/high — A1–A5 reused unchanged).

| | Year 1 (Q1–4) | Year 2 (Q5–8) | Year 3 (Q9–12) | 3-year total |
| --- | --- | --- | --- | --- |
| Low | $3 | $22 | $37 | $61 |
| Mid | $17 | $129 | $219 | $366 |
| High | $56 | $431 | $731 | $1,219 |

Full run-rate annual revenue ($225 mid) matches market-sizing.md's own SOM-at-0.5% figure exactly — this scenario is that estimate spread over the ramp, nothing more. **In plain terms: even at full ramp, three years of Stellar-only hackathon fees at 0.5 % add up to a few hundred dollars.**

### Scenario B — volume: adds bounties and recurring challenges

Market-sizing.md is explicit that bounties have no reliable public total, so B1 is a standalone labelled assumption, not derived from A1–A5. Assumed to start in Quarter 5 (after the first mainnet hackathon relationships exist), ramping over 4 quarters, then flat.

**B1 — Bounty volume (assumption):** low 5 bounties/quarter × $500 avg pool / mid 15 × $1,500 / high 30 × $3,000, same 0.5 % rate as Scenario A.

| | Year 1 | Year 2 | Year 3 | 3-year total (bounties only) |
| --- | --- | --- | --- | --- |
| Low | $0 | $31 | $50 | $81 |
| Mid | $0 | $281 | $450 | $731 |
| High | $0 | $1,125 | $1,800 | $2,925 |

Combined with Scenario A: **3-year total ≈ $142 (low) / $1,097 (mid) / $4,144 (high).** Volume roughly doubles-to-triples the status quo, but the absolute numbers stay small — bounties are frequent but individually tiny next to hackathon pools.

### Scenario C — rate by segment, within the 5 % on-chain ceiling

Same underlying pool volume as Scenario A. Assumption: small pools (under $5,000) pay a higher rate that bundles onboarding (canvas's own suggestion), larger pools stay near the current default. **C1 — blended effective rate (assumption, segment mix not yet known):** low 1.0 % / mid 1.8 % / high 3.0 %, all within the deployed 5 % ceiling (`MAX_FEE_BPS = 500`).

| | Full run-rate annual revenue | 3-year total |
| --- | --- | --- |
| Low | $75 | $122 |
| Mid | $810 | $1,316 |
| High | $4,500 | $7,313 |

Segment pricing alone, with no change in volume, is worth roughly **3.6× Scenario A** at the mid case — the single biggest lever Astrea already controls without needing new market reach.

### Scenario D — services: paid onboarding, judge-panel setup, sponsor reporting

**D1 — price per paid package (assumption, no comparable priced today):** low $150 / mid $300 / high $600. **D2 — packages sold per quarter, from Quarter 3, ramping over 2 quarters then flat (assumption, independent of hackathon count — could include DAO/bounty organizers too):** low 1 / mid 3 / high 6.

| | 3-year total |
| --- | --- |
| Low | $1,350 |
| Mid | $8,100 |
| High | $32,400 |

This is the largest revenue line in the model by a wide margin at mid/high — and also the least evidence-backed: D1 and D2 are both guesses with zero data points behind them (no organizer has ever paid Astrea for a service). Treat the size of this number as a reason to test it early (§6), not as a plan to rely on it.

### Scenario E — grants, "if awarded" (not modelled as revenue)

Per `docs/contracts-build-plan.md`: SCF Build Award up to $150,000 in XLM, tranche-based, evaluated on ecosystem value and roadmap — **not assumed won**. If awarded, **E1 (assumption on tranche timing/split, not public)**: roughly a third at award (Quarter 1), a third at Audit Bank / mainnet readiness (Quarter 2), a third at mainnet launch or an early traction milestone (Quarter 3) — up to $150,000 total, in XLM (subject to XLM/USD price risk, not modelled here).

This is a non-dilutive cash inflow that funds the audit co-pay and hosting runway, not a demonstration of product-market fit. **It is excluded from every break-even calculation below**, per the brief's instruction not to assume it is won.

## 4. Break-even

### Cash-only break-even (mid annual cash cost: $795)

Required annual prize-pool volume = annual cash cost ÷ rate:

| Rate | Required annual volume | vs. market-sizing layers |
| --- | --- | --- |
| 0.5 % | $159,000 | Exceeds even the **high**-case SOM ($150,000/year) — not reachable on Stellar-only volume at this rate |
| 2 % | $39,750 | Just under the **mid**-case SOM ($45,000/year) — reachable if Astrea captures the mid-case share |
| 5 % | $15,900 | Well under the **mid**-case SOM, about **35 %** of it |

Low/high cash-cost cases move these figures by roughly ±30 % (low: $110,400 / $27,600 / $11,040; high: $208,800 / $52,200 / $20,880 at 0.5 % / 2 % / 5 % respectively) but do not change the conclusion.

### Cash + founder opportunity cost break-even

At mid part-time opportunity cost ($28,800/year combined) plus mid cash cost ($795/year) = **$29,595/year**:

| Rate | Required annual volume | vs. market-sizing layers |
| --- | --- | --- |
| 0.5 % | $5,919,000 | ~79 % of **mid SAM** ($7.5M), ~20 % of **mid TAM** ($30M); exceeds even the **high**-case SOM ($150,000) by ~39× |
| 2 % | $1,479,750 | ~99 % of **low SAM** ($1.5M) — essentially all crypto-paying hackathons at the low estimate |
| 5 % | $591,900 | ~8 % of **mid SAM** ($7.5M), still ~4× the **high**-case SOM ($150,000) |

At full-time opportunity cost ($79,680/year combined) plus mid cash cost, total **$80,475/year**:

| Rate | Required annual volume |
| --- | --- |
| 0.5 % | $16,095,000 (~54 % of mid TAM) |
| 2 % | $4,023,750 (~54 % of mid SAM) |
| 5 % | $1,609,500 (~21 % of mid SAM) |

**Reading, plainly:** covering cash hosting costs alone is within reach at a 2–5 % rate and mid-case Stellar-only volume. Covering either founder's time — even part-time — is not, at any rate this model tests, without volume that reaches well beyond the Stellar-only SOM into the broader multi-chain SAM, which is not where Astrea's channels point today (per [competitive-analysis.md](competitive-analysis.md), it is Stellar-first on purpose).

## 5. Sensitivity: what moves the result most

1. **A5 — SOM capture share (volume).** Spans 20× between low and high case ($7,500 to $150,000/year in pool volume) and every scenario scales linearly with it. It is also the assumption Astrea can least control directly — it depends on other organizers' adoption, not on a decision Astrea makes.
2. **Rate (Scenario A vs. C).** Moving the blended rate from 0.5 % to a 1.8 % mid segment-blend is worth 3.6× revenue with **zero** change in volume, and the contract already supports it up to 5 % without a redeploy. This is the lever most within Astrea's own control.
3. **Founder time allocation (F2 vs. F3).** Swings the "opportunity cost" break-even bar by roughly 2.7× between part-time and full-time. Unlike the first two, this is a founder decision, not a market unknown — it says more about how much of their own time Lamberti and Monge choose to value against this project than about the business itself.

Services (Scenario D) is the single largest revenue line in absolute terms at mid/high case, but it is also the assumption with the least evidence behind it (D1, D2) — high potential upside, lowest confidence.

## 6. What this implies

Read plainly: **the current fee and Stellar-only volume do not make Astrea viable**, even before either founder is paid anything. The 0.5 % go-live fee is doing its intended job — it establishes that organizers accept a locked-pool product costs something — but it does not, by itself, cover the founders' time at any volume this model can currently justify. That is consistent with market-sizing.md's own conclusion, not a new finding.

The planned BRL 5 customer interviews (`docs/business/customer-interviews.md`) should prioritize testing, in order:

1. **Segment pricing acceptance (C1).** Will small-pool organizers actually pay 2–3 % if onboarding is bundled in, or does any rate above 0.5 % kill the pitch? This is the single biggest lever in this model, and currently has zero data behind it.
2. **Services willingness-to-pay (D1, D2).** Would organizers pay a flat fee for onboarding, judge-panel setup, or sponsor reporting, separate from the percentage fee? This scenario has the highest upside and the lowest confidence — it needs real quotes from interviews, not a guess.
3. **Bounty/DAO organizer interest (B1).** Do bounty and recurring-challenge organizers — a segment with no public volume data at all — see enough value to bring pools through Astrea, and at what frequency and size?
4. **Dispute-resolver acceptance**, carried over from the canvas: still untested, and it underwrites the fee's justification regardless of rate.

None of these interviews can validate the rate or volume assumptions retroactively; they are the mechanism for replacing A3, A5, B1, C1 and D1/D2 with real numbers.

## 7. Assumption register

| ID | Assumption | Value(s) (low/mid/high) | Basis | How to replace with real data |
| --- | --- | --- | --- | --- |
| A1–A5 | Hackathon count, avg pool, crypto share, Stellar SOM, capture share | See [market-sizing.md](market-sizing.md) | Reused unchanged from market-sizing.md | market-sizing.md's own "how to firm this up" section |
| F2 | Part-time founder hours/month, current reality | 40 / 60 / 80 h | Assumption — no fixed schedule reported | Track actual hours logged per founder for a month |
| F3 | Full-time founder hours/month | 166 h (all cases) | Founder-stated (~$3,300/month at $20/h) | N/A — founder-provided |
| F4 | Onboarding hours per organizer | 1 / 2 / 4 h | Assumption; canvas states hands-on onboarding happens, not how long it takes | Time the first 3–5 real onboardings on mainnet |
| F5 | Audit quote (Soroban escrow contract) | $15k / $25k / $40k | Assumption — no quote on file | Get an actual quote once SCF award is in hand and Audit Bank readiness is met |
| F6 | Audit co-pay (5 % of F5, refundable) | $750 / $1,250 / $2,000 | Contract fact (5 %) applied to assumption F5 | Recompute once F5 is real |
| F7 | Domain registration/renewal | $12 / $15 / $20 per year | Assumption — typical .com retail price, no specific registrar quote fetched | Get a quote from the chosen registrar (Vercel Domains, Namecheap, or similar) |
| F9 | Vercel seats needed at mainnet | 1 / 2 / 2 | Assumption on team structure | Confirm once mainnet infra ownership is decided |
| F10 | Supabase usage stays within Pro's included quotas | Implicit in mid/high cash cost | Assumption; Pro plan fact ($25/mo, 8GB DB, 250GB egress included) is sourced ([supabase.com/pricing](https://supabase.com/pricing)) | Watch actual usage after mainnet launch; add overage if exceeded |
| F11 | Resend free-tier sufficiency | Free until ~mid Scenario B volume | Assumption on email volume vs. Resend's published free-tier caps (3,000/month, 100/day) | Count actual notification volume per event once mainnet is live |
| B1 | Bounty count and average pool per quarter | 5×$500 / 15×$1,500 / 30×$3,000 | Assumption — market-sizing.md states no public total exists for bounties | Track actual bounty pools Astrea processes once available |
| C1 | Blended effective rate from segment pricing | 1.0 % / 1.8 % / 3.0 % | Assumption on segment mix (small vs. large pools) | Set an actual rate table and recompute from real pool-size distribution |
| D1 | Price per paid service package | $150 / $300 / $600 | Assumption — no comparable priced today | Quote it to real organizers in BRL 5 interviews |
| D2 | Paid service packages sold per quarter | 1 / 3 / 6 | Assumption — independent guess, not derived from event count | Track actual sales once offered |
| E1 | SCF Build Award tranche timing/split | ~1/3 at award, audit-readiness, and mainnet | Assumption — contracts-build-plan.md confirms "tranche-based," not the split | Use the actual award letter's tranche schedule if awarded |
| — | Vercel Pro price | $20/seat/month | Public, fetched 2026-09-24 ([vercel.com/pricing](https://vercel.com/pricing)) | Recheck at time of upgrade — prices change |
| — | Supabase Pro price | $25/month base | Public, fetched 2026-09-24 ([supabase.com/pricing](https://supabase.com/pricing)) | Recheck at time of upgrade |
| — | Resend pricing | Free: 3,000/mo, 100/day; Pro: $20/mo for 50,000/mo | Public, fetched 2026-09-24 ([resend.com/pricing](https://resend.com/pricing)) | Recheck at time of upgrade |
| — | Audit Bank co-pay rate and refund window | 5 %, refundable within 20 business days | `docs/contracts-build-plan.md` | N/A — repo fact |
| — | SCF Build Award ceiling | Up to $150,000 in XLM, tranche-based | `docs/contracts-build-plan.md` | N/A — repo fact |
| — | Go-live fee default / ceiling | 0.5 % default, 5 % ceiling | `DEFAULT_FEE_BPS = 50`, `MAX_FEE_BPS = 500` (contract) | N/A — repo fact |
