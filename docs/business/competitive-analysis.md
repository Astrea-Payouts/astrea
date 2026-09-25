# Astrea — Competitive analysis (draft)

Status: draft, September 2026. Public sources only; where a competitor's behaviour could not be verified, the table says so instead of guessing. Companion to [business-model-canvas.md](business-model-canvas.md).

## The competitor that matters most: the status quo

Most hackathon prizes today are announced by the organizer and paid afterwards by bank transfer, PayPal, Payoneer, Wise, or a transfer from a multisig. Nothing is locked beforehand. Delays come from tax forms, finance backlogs and sponsors paying late; Devpost itself tells winners fulfillment "can take up to 60 days from receipt of paperwork" ([Devpost Help Center](https://help.devpost.com/article/114-how-to-claim-your-hackathon-cash-prize-winners-only)). This is free for the organizer in fees, which is the bar Astrea's fee has to clear.

## Landscape

Astrea does not compete with hackathon platforms on discovery, registration or project galleries. It competes on one step: making the prize money provably exist before launch and paying it out without an operations team. The platforms below are grouped by how much they overlap with that step.

| | What it is | Prize locked before launch? | Payout | Fee model (public) | Overlap with Astrea |
| --- | --- | --- | --- | --- | --- |
| **Astrea** | Escrow-backed prize payouts on Stellar | Yes, enforced by the contract: an event cannot go live without the reserved pool | Judge releases on-chain, USDC reaches the winner's wallet in the same transaction | 0.5 % of the pool at go-live, 5 % ceiling on-chain, nothing at release | — |
| **Devpost** | Largest hackathon hosting platform; 1,200+ hackathons in 2023 ([Devpost 2023 review](https://info.devpost.com/blog/devpost-year-in-review-2023)) | No public mechanism found | Devpost "sometimes" distributes prizes; up to 60 days after paperwork | Custom enterprise pricing, not published | Low on hosting, high on payouts: Devpost-hosted events are the biggest pool of manually paid prizes |
| **DoraHacks** | Web3 hackathon and grants platform; reports $20M+ in grants and contributions to 3,000+ projects ([DoraHacks](https://dorahacks.io/discussion/1555583)) | Not verified | Not verified; prizes are frequently in the sponsoring chain's token | [Terms of Service](https://dorahacks.io/legal/terms) reserve the right to charge free-tier programs that advertise a prize pool a fee based on a percentage of it; the rate is not stated | Medium: hosts Stellar's own hackathons ([Build Better 2025](https://dorahacks.io/hackathon/build-on-stellar/detail), $25,000 USDC pool) |
| **Major League Hacking (MLH)** | Student hackathon league; 184 hackathons and 150,000+ hackers in the 2025 season ([MLH](https://blog.mlh.com/welcome-to-the-2026-hackathon-season-07-08-2025)) | No | Organizer's responsibility | Sponsorship model | Low: a channel to student organizers rather than a competitor |
| **Gitcoin** | Web3 public-goods funding; $60M+ distributed through Grants ([Gemini Cryptopedia](https://www.gemini.com/cryptopedia/gtc-crypto-gitcoin-bounties-web3-gtc-token)) | No, for grants; its bounty marketplace charged a 10 % funder-side platform fee ([Gitcoin blog](https://medium.com/gitcoin/a-gitcoin-platform-fee-905a0507961f)) | On-chain | 10 % on bounties (historical) | Low: grants and quadratic funding, not event prizes |
| **Superteam Earn** | Solana bounties, grants and jobs; Superteam Nigeria alone reports $1M+ earned by members since 2023 ([Techpoint Africa](https://techpoint.africa/insight/superteam-nigeria-1-million-earnings/)) | Not verified | Sponsor pays after winners are announced | Not published | Medium on bounties, but Solana-only |
| **GrantFox** | Stellar-native open-source contribution platform; rewards settled through Trustless Work escrows ([GrantFox docs](https://docs.grantfox.xyz/key-concepts/rewards)) | Not verified. Reward amounts are assigned by maintainers after the campaign ends and reviewed by GrantFox admins | Trustless Work escrow release | Not published | Adjacent, see below |
| **Trustless Work** | Escrow-as-a-service API on Stellar for platforms ([trustlesswork.com](https://www.trustlesswork.com/pricing)) | Yes, as infrastructure; the platform on top decides the flow | Milestone release to a payee set in the escrow | 0.3 % per release on mainnet; platforms add their own fee on top | Infrastructure, not a product for organizers. Astrea evaluated and chose its own contract instead (ADR-001) |

## Where Astrea is different

1. **The pool is locked before the event goes live, by the contract, not by policy.** `create_event` reserves the full reward out of the organizer's deposited balance, and only an event created that way can be moved to live by `set_event_in_progress`. The public materials cited here for the other platforms do not establish an equivalent contract-enforced guarantee.
2. **Winners are named at release, not at funding.** Generic escrows fix the payee when the escrow is created. Hackathon winners are unknown then, so a milestone escrow either needs a forwarding step (a custody window) or an escrow per winner. Astrea's `release_reward` takes the winner wallets as arguments and pays them in the same transaction (ADR-001, ADR-003).
3. **The organizer is outside the payout path.** No function the organizer can call moves reserved funds; post-launch cancellation goes through the dispute resolver. On the status quo and on most platforms, the organizer is the payout path.
4. **Fee at go-live, none at release.** Astrea charges once, visibly, before launch, and the ceiling is in the contract. Trustless Work charges 0.3 % at each release, plus whatever the platform adds.

## Where Astrea is weaker

- **No audience.** Devpost, DoraHacks and MLH bring participants. Astrea brings a payout guarantee to events that find their participants elsewhere. It has to plug into those platforms, not replace them.
- **Crypto-only.** Winners need a Stellar wallet with a USDC trustline. Corporate and student events that pay in fiat are out of reach until there is an off-ramp story.
- **Testnet only.** Nothing is on mainnet yet and the contract has not had its pre-mainnet security review (L01).
- **The fee is visible and the status quo's is not.** Manual payouts cost the organizer staff time, not a line item, so 0.5 % reads as a new cost unless the pitch is about trust and saved operations.

## GrantFox specifically

GrantFox is the closest neighbour: same chain, same stablecoin, escrow-backed rewards, and its own site mentions hackathons as a use case. The overlap is real but narrower than it looks:

- GrantFox pays for **open-source contributions to GitHub issues**, with amounts decided after the work is reviewed. Astrea pays **competition prizes** whose amounts are fixed before launch and whose winners are chosen by judges.
- GrantFox runs on Trustless Work escrows; Astrea runs its own contract because hackathon payouts need winners named at release (ADR-001).

The working position is complementary: GrantFox is a channel to Stellar builders and maintainers, and a Stellar hackathon listed there or on DoraHacks can still lock and pay its prizes through Astrea. If GrantFox ships a prize-pool product with pre-launch locking, this becomes a direct competitor and this section needs revisiting.

## Implications for the canvas

- Position Astrea as the payout layer that sits under existing hackathon platforms, not as another place to host hackathons.
- Start where the weaknesses do not bite: Stellar and other stablecoin-native events, where participants already have wallets.
- Price against the cost of a broken promise (late or missing prizes) and the operations time saved, not against other fees.
