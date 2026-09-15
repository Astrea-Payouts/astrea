# event-escrow — Stellar testnet proof

Real, verifiable testnet run of the `event-escrow` contract, executed with
[`scripts/run-testnet-proof.sh`](scripts/run-testnet-proof.sh). Every
transaction below was submitted to Stellar testnet and is checkable on
Stellar Expert — nothing simulated.

## Issue #5 scope correction

Issue #5, as originally filed, describes "N milestones," disputing a second
milestone, and "milestone independence." None of that exists in the shipped
contract, and this run does not implement it. The actual model in
[`src/lib.rs`](src/lib.rs) is:

- One shared contract instance. Each organizer has a single `AdminWallet {
  token, balance }`.
- `create_event` reserves one `reward: i128` out of that balance for one
  event.
- `release_reward` takes a `Vec<Winner>` whose `amount`s must sum **exactly**
  to `reward`, and pays every winner in a single atomic call before flipping
  the event to `Ended`. There is no independent per-milestone release and no
  `dispute`/`resolve_dispute` function anywhere in the contract (that's
  separate, unbuilt issue #22).

This run proves the atomic multi-winner split that the shipped contract
actually implements, plus a second terminal path (cancel + refund), against
real testnet RPC.

## Setup

- **Contract**: `event-escrow`, built with `stellar contract build`
  (target `wasm32v1-none`, per the contract's `Makefile`).
- **Token**: native XLM's Stellar Asset Contract (SAC), not the testnet USDC
  issuer — chosen for simplicity, since testnet identities are funded with
  native XLM by friendbot with no separate trustline/mint step needed.
- **Second scenario**: `set_event_cancelled` (pre-launch cancel + refund) was
  chosen over `expire_event`. `expire_event` needs the ledger's on-chain
  timestamp to actually cross a deadline, which means the script would have
  to block waiting for real testnet ledgers to close — `set_event_cancelled`
  exercises the same "funds return to the organizer's wallet" guarantee
  deterministically, in the same run, with no timing dependency.

## Current testnet deployment (2026-09-14)

Deployed with `scripts/deploy-testnet.sh` using the project's own governance
identities (not throwaway keys). This is the contract `apps/web`
(`NEXT_PUBLIC_ESCROW_CONTRACT_ID`) and `services/core-go`
(`ESCROW_CONTRACT_ID`) point at. It replaces the 2026-09-07 instance below,
which predates the resolver, `emergency_withdraw`, `resolve_dispute` and the
go-live fee/treasury and is kept only as the reference run's record.

| Field | Value |
|-------|-------|
| Contract ID | [`CCNAQ6MC3LZMT3U3RHVS62HEXCHTHDACSGSDKUTJUQWHGPYSAD7NFQZD`](https://stellar.expert/explorer/testnet/contract/CCNAQ6MC3LZMT3U3RHVS62HEXCHTHDACSGSDKUTJUQWHGPYSAD7NFQZD) |
| Emergency admin | `GB7BZCAAW6LPA3EQD6NQD3CXJ4446H5W7ZU6IEVFRB3H5PSZF7IGMADQ` |
| Default resolver | `GDBGUDZFW55W7ZR2DIDN2KZEIUPRBI3SSTOC4BBPNSHK5UHLWVQO7ARM` |
| Treasury | `GDQGMSSSCASTOWK42SFOM5Z74GWFKAGHXMBGH5UJNVXUA5I57IMR3ERB` (USDC trustline set) |
| Fee (bps) | 50 (default; `set_fee_bps` not called) |
| Token whitelist | disabled (default) — every SAC accepted; USDC testnet `GBBD47IF…` is the MVP token |

| Call | Tx hash |
|------|---------|
| `deploy` | [`1efb74d3…`](https://stellar.expert/explorer/testnet/tx/1efb74d3dbbe1f25bcb54ac999f0c4013218e228b82dab81749ad081ed2c028d) |
| `initialize_emergency_admin` | [`6735b075…`](https://stellar.expert/explorer/testnet/tx/6735b075dc13a5c1207bcfd6db9352c513c4f164c9858ece89d2ae54d10e862d) |
| `initialize_default_resolver` | [`8374ad0c…`](https://stellar.expert/explorer/testnet/tx/8374ad0c5b10de79a2cf6fa766355e7f0153d18f6519f894cd1854ad34675d62) |
| `initialize_treasury` | [`4ceef903…`](https://stellar.expert/explorer/testnet/tx/4ceef90350211b88faacbba7bb1f571cf0d9900261fce32c3011ed0efb4335de) |

Readback after init: `get_default_resolver`, `get_treasury` and
`get_fee_bps` return the values above.

## Smoke test after governance deploy (USDC)

Ran `services/core-go/cmd/escrow-testnet-proof` in USDC mode
(`TOKEN=USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`)
against the governance-deployed contract above — the instance the app and
Go service actually point at, not a throwaway one.

| Field | Value |
|-------|-------|
| Date | 2026-09-14 |
| Contract ID | [`CCNAQ6MC3LZMT3U3RHVS62HEXCHTHDACSGSDKUTJUQWHGPYSAD7NFQZD`](https://stellar.expert/explorer/testnet/contract/CCNAQ6MC3LZMT3U3RHVS62HEXCHTHDACSGSDKUTJUQWHGPYSAD7NFQZD) |
| Asset | USDC testnet, issuer [`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`](https://stellar.expert/explorer/testnet/asset/USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5-1) |
| Admin (throwaway, funded via Circle's testnet faucet) | `GAYCSNYNFCV5QYTE7CO5BN6Z3LEGXZ26Y73GWH7CSKLELDR6VUV7SHIB` |
| Deposit | 50,000,000 units (5.0000000 USDC) |

All 7 scenarios (A-G) ran clean, same as the throwaway-contract proof in
`services/core-go/cmd/escrow-testnet-proof`'s own README/PR history — including
both scenarios that must be rejected on-chain (D's post-launch
`set_event_cancelled`, G's single-signature `emergency_withdraw`).

| Scenario | Step | Detail | Tx hash / outcome |
|---|---|---|---|
| setup | `deposit_funds` | admin deposits 50,000,000 units | [`4475da47…`](https://stellar.expert/explorer/testnet/tx/4475da47c4cb9fe908735dca6d102f815d3f220b82909c22c2844006f69837de) |
| A | `create_event` | event `097341dd…`, reward 4,000,000 units | [`667d6a7e…`](https://stellar.expert/explorer/testnet/tx/667d6a7e5afd7c27efa1be147e6b5b6ce5f786caef98f8dc2fd207793af5d4a2) |
| A | `get_event` | read-only readback | [`4d274fe0…`](https://stellar.expert/explorer/testnet/tx/4d274fe05c8748a8731553e7f9bd63a9c8eb155661527596daf93ebb4c6b66ae) |
| B | `create_event` | event `00278585…` | [`4fbaf5af…`](https://stellar.expert/explorer/testnet/tx/4fbaf5af45fcf2812ca3c0275255a4f2d36a0e3548756f956e97385c3884b410) |
| B | `set_event_in_progress` | go-live fee 50,000 units | [`d9744371…`](https://stellar.expert/explorer/testnet/tx/d97443715c722a96c2af240d0a2f2864db386cf0e27fb865f1b41059ca83c872) |
| B | `release_reward` | 3-way split 3,333,001 / 3,333,000 / 3,334,000 units — remainder rule fires on a reward not divisible by 3 | [`9f1ce23a…`](https://stellar.expert/explorer/testnet/tx/9f1ce23a09cc9a56787728564ebbea4f4b8b590439e445ad966dc1d97076456e) |
| C | `create_event` | event `6a6365aa…` | [`1320625c…`](https://stellar.expert/explorer/testnet/tx/1320625cc94154657bb2d548f9877188982ebc9a9e26f5c82169b8830f02a208) |
| C | `set_event_cancelled` | pre-launch (Created) refund | [`26d84fd9…`](https://stellar.expert/explorer/testnet/tx/26d84fd9ff0daa92df3fb0ba91ba8b66d00093e8c678d963a1774a3df35473e2) |
| D | `create_event` | event `fd23c9c6…` | [`f3b55344…`](https://stellar.expert/explorer/testnet/tx/f3b5534440eec12963acff9e03345ef51471ad1b002f7aff01d84465375cf900) |
| D | `set_event_in_progress` | go-live fee 25,000 units | [`b8bafbce…`](https://stellar.expert/explorer/testnet/tx/b8bafbcedbb2ac2d6e7b138759ec727ee222139d408ea0ca3f06889717204782) |
| D | `set_event_cancelled` | **rejected** — post-launch cancel forbidden (ADR-006) | `HostError: Error(WasmVm, InvalidAction)` |
| E | `create_event` | event `4a8b84da…` | [`a09cd80c…`](https://stellar.expert/explorer/testnet/tx/a09cd80cef1a4932896d852801e2daf23de620f4eb4934e27fcef03bca94e3c7) |
| E | `set_event_in_progress` | go-live fee 30,000 units, short `judging_deadline` | [`71df39a4…`](https://stellar.expert/explorer/testnet/tx/71df39a477646ff96ed4845bd30dafbaea08b2e2362690d2d38e78822f5b4ca3) |
| E | `resolve_dispute` (judge) | **rejected** — only the event's resolver may call it | `HostError: Error(WasmVm, InvalidAction)` |
| E | `resolve_dispute` (resolver) | after `judging_deadline` passed: +4,000,000 units to a team member, +2,000,000 to the organizer | [`9c8393ee…`](https://stellar.expert/explorer/testnet/tx/9c8393eef6287782469879a5e145e35b9ce0691e712c9cf0a67a9f078883f546) |
| F | `create_event` | event `1bcb990a…` | [`6c9d4bc7…`](https://stellar.expert/explorer/testnet/tx/6c9d4bc7121f844a6a6b64138cd0668556f5f0f5bb91d393bce6d61d753f2706) |
| F | `emergency_withdraw` | two signatures (admin's envelope + resolver's `SignAuthEntry`) | [`0c5a05b3…`](https://stellar.expert/explorer/testnet/tx/0c5a05b300a178781b8394cb00734bad70195220e963cf6f71adaf04c263ebbd) |
| G | `create_event` | event `f09230e5…` | [`afae4ac0…`](https://stellar.expert/explorer/testnet/tx/afae4ac0bc601691adf5fbc270c607b78a0880ec601cb9d1b0309c0c303dc1ab) |
| G | `emergency_withdraw` | **rejected on-chain** — admin's signature alone, resolver's auth entry withheld | `bc4e077f…` failed |

**Go-live fee / treasury verification.** Only `set_event_in_progress` charges
the fee, and only B, D and E ever call it — F and G go straight from
`create_event` to `emergency_withdraw` and never bring the event to
`InProgress`, so they charge nothing. (The original task brief assumed D, E,
F and G each charged a fee; that doesn't match `mustGoLive`'s call sites in
`cmd/escrow-testnet-proof/main.go`, so this section documents what the code
and the run actually did.) The treasury
(`GDQGMSSSCASTOWK42SFOM5Z74GWFKAGHXMBGH5UJNVXUA5I57IMR3ERB`) had never
received a USDC payment before this run — its balance went from 0 to
**0.0105000 USDC (105,000 units)**, matching 50,000 (B) + 25,000 (D) + 30,000
(E) exactly. Confirmed by reading the account's balance and full payments
history from Horizon after the run: the only three incoming USDC transfers
it has ever received are the three `set_event_in_progress` calls above.

## Results (reference run — 2026-09-07, superseded instance)

**Contract ID:** [`CAD5IOA2FFSUTRIHEK6YQ2BPO2JVDPXYRXBVMPBBWFQEWRWKFRG36TQH`](https://stellar.expert/explorer/testnet/contract/CAD5IOA2FFSUTRIHEK6YQ2BPO2JVDPXYRXBVMPBBWFQEWRWKFRG36TQH)
**Token (native XLM SAC):** [`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC)

**Identities:**

| Role | Address |
|---|---|
| organizer (admin) | `GCRN2BZIQPZ3AYMJUWB2FTQQD2BFQYCFS6UF7ELWIC2RRDTDXND4XI23` |
| judge | `GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L` |
| winner1 | `GBXNBZFHSILK4HNBOVGANXADKY6FGJYH2R253PBPT4QF3CXEFJXBU27X` |
| winner2 | `GBLH7BFPOM5AUYM7E64SP25AR6HOUM3IDSZEFM6OEBHRVEM67JQZPEQA` |

**Transaction trail:**

| # | Step | Detail | Tx hash | Stellar Expert |
|---|---|---|---|---|
| 1 | Contract upload | Wasm hash `95fc04a342ea8e88c5aaa546c664a65db29178c74bc75cd97b7cadaf487ab09e` | `852088e2f80887613ef8bb96b36b2aa78de08c5556b9ec5fe4fb13839ef5ba9f` | [view](https://stellar.expert/explorer/testnet/tx/852088e2f80887613ef8bb96b36b2aa78de08c5556b9ec5fe4fb13839ef5ba9f) |
| 2 | Contract deploy | Instance created | `a19ffee3bff19607047a0c3b909530336b939be0ca6abd6562f769ff06d3e46f` | [view](https://stellar.expert/explorer/testnet/tx/a19ffee3bff19607047a0c3b909530336b939be0ca6abd6562f769ff06d3e46f) |
| 3 | `deposit_funds` | organizer deposits 100 XLM into their AdminWallet | `9a85121a48aa6184954959827e52b884a9d6d33921057beb7f639019aaa6970c` | [view](https://stellar.expert/explorer/testnet/tx/9a85121a48aa6184954959827e52b884a9d6d33921057beb7f639019aaa6970c) |
| 4 | `create_event` (A) | event `ea5e62c02af65160255883b9f756f6ef`, reward 30 XLM | `24472f0d416f7c171e812a392a5f1195a3ab7d2702c10d672f3b027b12e74783` | [view](https://stellar.expert/explorer/testnet/tx/24472f0d416f7c171e812a392a5f1195a3ab7d2702c10d672f3b027b12e74783) |
| 5 | `set_event_waiting_for_start` (A) | | `6cea88fa55476a977f4611fe15d23f6e60855f03b558678117ca461e9ac8ae83` | [view](https://stellar.expert/explorer/testnet/tx/6cea88fa55476a977f4611fe15d23f6e60855f03b558678117ca461e9ac8ae83) |
| 6 | `set_event_in_progress` (A) | | `b738caf468362351713b29589be31a7c2ced00e0cfe645aecec762b4dbbdbccc` | [view](https://stellar.expert/explorer/testnet/tx/b738caf468362351713b29589be31a7c2ced00e0cfe645aecec762b4dbbdbccc) |
| 7 | `release_reward` (A) | **atomic split**: winner1 +20 XLM, winner2 +10 XLM in one call, event → `Ended` | `fb088bb7786dd787a3e6afef1269a8e095f24240063a0a799ba9854466884fcb` | [view](https://stellar.expert/explorer/testnet/tx/fb088bb7786dd787a3e6afef1269a8e095f24240063a0a799ba9854466884fcb) |
| 8 | `create_event` (B) | event `6fe79787ba2c600e3257bb567a059200`, reward 10 XLM | `b54c0947120ec56d16dd94bb186eec1f2dfb411674b4eff6afb827c783d1ca54` | [view](https://stellar.expert/explorer/testnet/tx/b54c0947120ec56d16dd94bb186eec1f2dfb411674b4eff6afb827c783d1ca54) |
| 9 | `set_event_waiting_for_start` (B) | | `45e86345731f956dd2d4963e6d523fc45452d85c465a34b41b9ee25c3308af99` | [view](https://stellar.expert/explorer/testnet/tx/45e86345731f956dd2d4963e6d523fc45452d85c465a34b41b9ee25c3308af99) |
| 10 | `set_event_cancelled` (B) | **refund path**: 10 XLM returned to organizer's AdminWallet, event → `Cancelled` | `1e5e0ce1530d1d051990b6ab850936ca5a47b406ac2d495ef8762c13300722db` | [view](https://stellar.expert/explorer/testnet/tx/1e5e0ce1530d1d051990b6ab850936ca5a47b406ac2d495ef8762c13300722db) |

**Post-run balances (read-only, verified against the trail above):**

| Account | Balance | Explanation |
|---|---|---|
| organizer AdminWallet | 70 XLM (`700000000` stroops) | 100 deposited − 30 (event A reward) − 10 (event B reward) + 10 (event B refund) |
| winner1 native balance | 10,020 XLM (`100200000000` stroops) | friendbot's 10,000 **+ 20**, paid atomically by `release_reward` |
| winner2 native balance | 10,010 XLM (`100100000000` stroops) | friendbot's 10,000 **+ 10**, paid atomically by `release_reward` |

**Post-run event states (read-only):** balances alone would not catch a payout
that moved the right amounts but left the event stuck, so the script reads both
events back. `EventState` is a plain enum in [`src/lib.rs`](src/lib.rs).

| Event | State | Meaning |
|---|---|---|
| A (`ea5e62c02af65160255883b9f756f6ef`) | `3` | `Ended` — the reward was released in full |
| B (`6fe79787ba2c600e3257bb567a059200`) | `99` | `Cancelled` — the reward was refunded to the AdminWallet |

Note that the `release_reward` transaction (#7) is signed by the **judge**
account, not the organizer's — the organizer cannot move escrowed funds at all,
which is ADR-003's core guarantee holding on a real network rather than only in
the in-process test suite.

## Running it yourself

```bash
cd smart-contracts/astrea/contracts/event-escrow
./scripts/run-testnet-proof.sh
```

The script generates fresh testnet identities (friendbot-funded), builds and
deploys the contract, and runs both scenarios end to end, printing every
transaction hash as it goes. It uses only the stellar-cli's local identity
store — no secrets are written to disk in this repo.

`scripts/deploy-testnet.sh` (issue #8) deploys a fresh contract and runs the
three governance initializations (emergency admin, default resolver,
treasury) against real governance keys — see that script's header for usage.

## Verification

`cargo test` still passes 78/78, unchanged — this task only added the script
above and this README; `src/lib.rs` and `src/test.rs` were not touched.
