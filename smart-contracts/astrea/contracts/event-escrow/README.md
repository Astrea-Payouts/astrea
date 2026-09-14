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
`get_fee_bps` return the values above. No functional scenario has run
against this instance yet — that is the USDC smoke test tracked in
`services/core-go/cmd/escrow-testnet-proof`.

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
