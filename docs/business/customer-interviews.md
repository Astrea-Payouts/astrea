# Astrea — Customer interview kit (BRL 3 → BRL 4)

Status: draft, September 2026. This is a kit to run — screener, scripts, tracker, scoring rules — not a report of findings. No interview has happened yet; every number in the tables below is a placeholder to fill in, not a result. Companion to [business-model-canvas.md](business-model-canvas.md), [competitive-analysis.md](competitive-analysis.md) and [market-sizing.md](market-sizing.md).

Method note: every question in the script asks about something the organizer already did, not what they would hypothetically do. If an interview drifts into "would you use this," pull it back to "tell me about the last time you paid out a prize."

## 1. Purpose and hypotheses

The canvas lists four assumptions Astrea is built on but has not tested against a real organizer or participant. BRL 4 requires at least 10 interviews with organizers who paid prizes in the last 12 months, plus a lighter check on the participant-side assumption. Each hypothesis gets a threshold fixed now, before the first call, so a good story from one talkative organizer can't move the goalposts later.

| # | Hypothesis (from the canvas) | Pass | Fail | Inconclusive |
| --- | --- | --- | --- | --- |
| H1 | Organizers see a pre-funded, verifiable pool as worth paying for | ≥6 of 10 describe a concrete past cost from manual payouts (a delay, a dispute, a participant complaint, staff time chasing a transfer) **and** say a pool they could point to before launch would have avoided or reduced it | ≤3 of 10 | 4–5 of 10 |
| H2a | 0.5 % is accepted without negotiation | ≥7 of 10 call 0.5 % reasonable once anchored against their own last payout's real cost, without asking to negotiate it down | ≤3 of 10 push back or want a lower rate | 4–6 of 10 |
| H2b | Small-pool organizers would pay more for onboarding help | Among organizers whose last pool was under $5,000, ≥50 % say they'd pay a flat add-on or a higher percentage for hands-on setup (wallets, trustlines, judge flow) | <25 % | 25–49 % |
| H3 | Organizers accept Astrea or a named third party as dispute resolver | ≥7 of 10 accept a neutral resolver (Astrea's own or one they'd name) without wanting to keep resolution power themselves | ≤3 of 10 insist on resolving disputes themselves or refuse a third party outright | 4–6 of 10 |
| H4 | Participants choose events because the pool is verifiable | See the separate method below | See below | See below |

H4 needs its own instrument: it is a participant-side claim, and the organizer interviews above can't test it — organizers guess at participant motivation, they don't report it. Use one of:

- **5 short interviews (10–15 min)** with participants who competed in at least two hackathons or bounty programs in the last 12 months. Ask about a specific past decision (did they ever check whether a prize was real before committing time, ever walked away from an event over payment doubts, ever heard of a winner not getting paid) — never "would proof of funds matter to you."
- **A short survey** (5–8 questions, same past-behavior framing) distributed through organizer channels or Stellar community channels, if 5 interviews are hard to book in the same window as the organizer round.

H4 threshold: **Pass** if ≥3 of 5 interviews (or ≥30 % of survey respondents) describe a concrete past instance of checking prize legitimacy, hesitating over it, or knowing someone who wasn't paid. **Fail** if 0–1 of 5 (or <10 %). **Inconclusive** in between.

## 2. Screener

**Qualifies:** organized or funded a hackathon, bounty program, or challenge that paid a cash or stablecoin prize in the last 12 months, and was involved in the decision about how that prize was funded or paid out (not only judging or marketing it).

**Disqualifiers:**

- Never handled the money side — pure judge, mentor, or marketing role with no visibility into how prizes were funded or paid.
- The "prize" was non-monetary (swag, credit, recognition only).
- Internal-only event with no external participants and no real budget decision behind the prize (e.g., an internal team offsite with a token award).

**Target mix (10 interviews, weighted toward the canvas's own segment priority):**

| Segment | Target count | Why this weight |
| --- | --- | --- |
| Foundations / grant programs running hackathons (Stellar ecosystem, other L1/L2) | 3–4 | Highest canvas priority; likely already stablecoin-native |
| Web3 communities and DAOs running bounties/challenges | 3–4 | Highest canvas priority; recurring smaller pools, most exposed to manual multisig pain |
| University / student hackathon organizers | 2 | Second priority; smallest pools, least leverage — a distinct read on H2b |
| Companies running public developer challenges | 1 | Lowest priority; include one to sanity-check whether the fiat/tax gap the competitive analysis flags actually blocks the conversation |

If recruiting runs short in one bucket, do not backfill with a disqualified contact — report the gap in the tracker instead of diluting the sample.

## 3. Recruiting channels

Grounded in the canvas's own channel list, not new ones:

- **Stellar ecosystem / SCF community** — Discord, community calls, past SDF and SCF-funded hackathon organizer lists. Warmest channel: shared chain, shared stablecoin, no need to explain what USDC on Stellar means.
- **DoraHacks organizer outreach** — hackathons and bounty programs listed on DoraHacks that show a stated prize pool; contact the organizer of record, not participants.
- **Devpost organizer outreach** — same approach, filtered to hackathons whose rules page states a cash or stablecoin prize (Devpost's own prize-structure guidance gives a $15k–$100k+ range to sample from).
- **Stablecoin-paying events generally** — any hackathon, bounty, or challenge found through the above that already states prizes in USDC or another stablecoin; these organizers have already solved the "can we pay in crypto" question, so the conversation starts at payout mechanics, not onboarding.

**Target: 15 contacts to land 10 interviews** (a ~67 % conversion rate on warm-to-lukewarm outreach, which is a reasonable planning assumption for a cold-to-warm mix, not a benchmark from a run). Track actual conversion in the tracker (Section 6) and adjust the contact list size for the next round once real numbers exist.

## 4. Outreach templates

Short, no pitch, asks for time about a past event. Send the follow-up only once, 3–4 days after no reply.

### Cold DM / email — English

> Subject: Quick question about [event name]'s prizes
>
> Hi [name] — I'm building a project in the Stellar ecosystem and I'm trying to understand how hackathon and bounty organizers actually handle prize money today. I saw you ran [event name] — would you have 25 minutes to walk me through how prizes got paid out last time, what worked, and what didn't? Not selling anything, just want to hear from someone who's actually done it.
>
> If you're up for it, here's my calendar: [link]. Happy to work around your schedule otherwise.
>
> Thanks,
> [Christopher Lamberti / Dereck Monge]

### Follow-up — English

> Hi [name] — following up in case this got buried. Still hoping to hear how you handled prize payouts for [event name], if you have 25 minutes sometime. No worries if not, and thanks either way.

### Cold DM / email — Spanish (neutral Latin American)

> Asunto: Una pregunta rápida sobre los premios de [nombre del evento]
>
> Hola [nombre] — estoy trabajando en un proyecto dentro del ecosistema de Stellar y quiero entender cómo los organizadores de hackathons y programas de recompensas manejan hoy el dinero de los premios. Vi que organizaste [nombre del evento] — ¿tendrías 25 minutos para contarme cómo se pagaron los premios la última vez, qué funcionó y qué no? No es una venta, solo quiero escuchar la experiencia de alguien que ya pasó por esto.
>
> Si te interesa, acá está mi calendario: [link]. Si preferís coordinar de otra forma, sin problema.
>
> Gracias,
> [Christopher Lamberti / Dereck Monge]

### Follow-up — Spanish

> Hola [nombre] — te escribo de nuevo por si el mensaje anterior se perdió. Sigo con ganas de escuchar cómo manejaron los pagos de premios en [nombre del evento], si tenés 25 minutos en algún momento. Si no se puede, no hay problema, y gracias de todas formas.

## 5. Interview script (~25 minutes)

Each question is tagged with the hypothesis it feeds. Do not read the tags aloud. Keep the demo strictly at the end — leading with it turns every later answer into a reaction to a pitch instead of a report of past behavior.

**Warm-up (2 min)**

1. Tell me about the last hackathon, bounty round, or challenge you ran or funded. Roughly how big was the prize pool, and when was it?

**Past payout mechanics — feeds H1 (8 min)**

2. Walk me through what happened between "we announced the prizes" and "the winners actually had the money." Who did what, and roughly how long did it take end to end?
3. Did anything go wrong or take longer than expected in that process — a delay, a dispute, a winner who couldn't be paid the way you'd planned, a participant who asked "is this prize real"? Tell me about a specific time, if one comes to mind.
4. Who on your side spent time on that, and roughly how much time — hours, days?
5. How did you announce the prize pool to participants before the event — and did anyone ever ask you to prove the money was actually set aside?

**Pricing probe — feeds H2a and H2b (6 min)**

6. Anchor first: thinking about the time and any fees from that last payout (bank transfers, PayPal/Payoneer cuts, staff time you'd value at some rate) — what would you say that cost you, roughly, all in?
7. Reveal: a service that locks the full pool on-chain before the event goes live, and pays winners directly when a judge approves, charges a one-time 0.5 % fee on the pool at launch — nothing to participants, nothing at payout. What's your reaction to that, given what you just told me it cost you last time? *(Listen for negotiation — does the number get pushed back on, or accepted as-is?)*
8. If your last pool was on the smaller side: would a flat setup fee or a higher percentage make sense to you if it meant someone walked you through wallets, trustlines, and the judge flow instead of you figuring it out alone?

**Dispute-resolver probe — feeds H3 (4 min)**

9. If a judge had gone silent, or a result had been contested, in your last event — who would have had the final say on what happened to that prize money?
10. How would you feel about a neutral third party — not you, not the judge — being the one who resolves that kind of situation, agreed on before the event starts?

**Wrap-up and demo offer — last, always (5 min)**

11. Anything about paying out prizes that I haven't asked about but should have?
12. Only now, offer: "Would it be useful if I showed you, in about 2 minutes, what a locked-pool event page looks like on testnet?" Show only if they say yes. Do not pitch if they decline — thank them and close.

## 6. Note-taking template and evidence tracker

Use one tracker row per interview, filled in live or immediately after (memory fades fast). Keep raw notes in a local file outside the repo (see Section 8) and put only the aggregate row here.

| Field | What to capture |
| --- | --- |
| Date, interviewer | — |
| Segment | Foundation/grant program, web3/DAO, university, company |
| Pool size (last event) | USD value, approximate is fine |
| Payout method used | Bank transfer, PayPal/Payoneer, crypto wallet transfer, multisig, other |
| Pain evidence (H1) | Quote or paraphrase of a concrete delay/dispute/complaint/time cost, or "none reported" |
| Price reaction (H2a/H2b) | Accepted / negotiated / rejected 0.5 %; and, if small pool, yes/no on paying more for onboarding |
| Resolver reaction (H3) | Accepted neutral third party / wanted to keep control / refused outright |
| Commitment signal | Any concrete next step offered unprompted or accepted when offered — e.g. "agreed to a testnet pilot," "asked to be notified at mainnet," "no further interest" |

**Evidence tracker (fill in as interviews happen):**

| # | Date | Segment | Pool size | Payout method | Pain evidence | Price reaction | Resolver reaction | Commitment signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |
| 6 | | | | | | | | |
| 7 | | | | | | | | |
| 8 | | | | | | | | |
| 9 | | | | | | | | |
| 10 | | | | | | | | |

Add a second, shorter tracker for the H4 participant round (segment, past behavior evidence, commitment signal only — no pricing or resolver columns apply).

## 7. Synthesis — scoring against the thresholds

Once 10 organizer interviews (and the H4 round) are done:

1. Count rows against each threshold in Section 1. Record the result as Pass, Fail, or Inconclusive per hypothesis — not a blended score across hypotheses, since they answer different questions.
2. **H1 outcome feeds positioning.** Pass: lead outreach and the event page with the concrete cost Astrea removes, using the pattern that showed up most (delay vs. dispute vs. staff time). Fail: the "pre-funded pool" pitch is not landing as a real problem — revisit whether the target segment is right before touching the product. Inconclusive: run 3–5 more interviews concentrated in the segment that scored weakest before deciding either way.
3. **H2a/H2b outcome feeds pricing.** H2a pass + H2b pass: keep 0.5 % as the default and start scoping a paid onboarding add-on for small pools. H2a fail: the rate itself is the blocker — model the mid-case SAM in [market-sizing.md](market-sizing.md) at a lower rate before assuming volume will fix it. H2a pass but H2b fail: small organizers don't want to pay more, so onboarding has to be free-to-cheap and self-serve, not a services line.
4. **H3 outcome feeds the resolver role.** Pass: keep Astrea as the default resolver as currently designed. Fail or mostly "wants to keep control": the product may need an organizer-controlled fallback path for low-stakes events, which is a real change to ADR-003/ADR-006, not a copy change — flag it as a design question rather than deciding it from interview notes alone.
5. **H4 outcome feeds segment priority, not pricing.** Pass: participant-side trust is a real lever, worth mentioning in outreach to organizers who care about registration numbers. Fail: don't lean on "participants will flock to verifiable events" in the pitch — the value proposition rests on the organizer's own pain (H1), not on a participant effect that didn't show up.
6. Write the outcome and its implication into the canvas's "What BRL 3 needs from here" section (or a new "BRL 4 results" section) once the round is done — this file stays the reusable kit, the canvas stays the living state of the business model.

## 8. Ethics and consent

- Ask permission to take notes at the start of the call, before question 1. State plainly that this is research, not a sales call.
- No recording without explicit, separate consent — asking for notes and asking for a recording are two different asks.
- Raw notes (names, specific event names, anything identifying) stay out of git entirely — keep them in a local, non-repo location.
- The tracker in Section 6, once filled in, goes into the repo only as **anonymized aggregates** — segment, pool-size bracket, and the pattern of the reaction, not the organizer's name or event name. If a quote is worth keeping verbatim, strip identifying details before it goes in this file.
- If an interviewee asks how their input will be used, tell them: to decide whether and how Astrea's pricing and dispute-resolution design change, and that nothing they say will be attributed to them by name in anything public.
