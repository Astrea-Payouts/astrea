# K02 (server-build-plan.md) — Go ↔ Soroban integration spike

**Status: complete, 2026-08-06.** Confirms a Go service can build, sign, and submit Stellar transactions against the K01 contract end to end — using the Stellar Go SDK directly (`github.com/stellar/go`), no `soroban-cli`, no shelling out to another process. This is what `services/core-go` will actually do in Phase 1.

Deploys a **fresh instance** of K01's already-compiled wasm (`../k01-soroban-escrow/target/wasm32v1-none/release/k01_soroban_escrow.wasm`, reused as-is, not rebuilt) and drives it through the same lifecycle K01 validated, entirely from Go: upload wasm → create contract → initialize → fund → approve → NEG-1 → release → NEG-2.

Result contract: `CC76XEKP5AI6AL7TX7O2XKXBD5A5HOUE4C6L36OVNO7XOKCSGWLDTCE6`.

## What it verifies — results

| # | Check | Result |
| --- | --- | --- |
| 1 | Go can upload contract wasm, hand-building the `InvokeHostFunction` XDR operation itself | ✅ PASS |
| 2 | Go can create a fresh contract instance (`CreateContract`, address-based `ContractIdPreimage` + random salt) and recover the resulting contract address from the simulation's return value | ✅ PASS |
| 3 | Go can drive the full lifecycle — `initialize`, `fund`, `approve`, `release` — including the simulate → attach footprint/fee/auth → sign → submit → poll cycle for each call | ✅ PASS |
| 4 | Go-signed unauthorized calls are rejected the same way CLI-signed ones are | ✅ PASS — see NEG-1 |
| **NEG-1** | Organizer attempts `release` directly, signed and submitted by Go | ✅ rejected **on-chain** (transaction included in the ledger but failed `require_auth`) — a stronger check than K01's CLI-level rejection, since this one actually reached the ledger's own auth enforcement, not just a local "missing signing key" short-circuit |
| **NEG-2** | Release the same escrow twice, via Go | ✅ rejected — simulation itself failed with `HostError: Error(Contract, #7)` = `Error::AlreadyReleased`, same contract-level guarantee K01 confirmed |

## Findings folded into ADR-008

1. **The Go SDK has no high-level "invoke a contract" helper** — `txnbuild.InvokeHostFunction` exists, but building `HostFunction`/`CreateContractArgs`/`ScVal` values is manual, low-level XDR construction (`github.com/stellar/go/xdr`). Budget for this in E02 (`Go EscrowClient`) — it's not a thin wrapper over a convenience API, it's real integration work.
2. **The simulate → sign → submit → poll pattern has to be hand-rolled too.** `clients/rpcclient` (package name `client`, despite the directory being `rpcclient`) exposes `SimulateTransaction`/`SendTransaction`/`GetTransaction`/`LoadAccount` as raw JSON-RPC calls — there's no "preflight and assemble" helper. The pattern that worked: build an unsigned tx with empty `Auth`/`Ext`, simulate it, parse `TransactionDataXDR` into `xdr.SorobanTransactionData` and each `Results[0].AuthXDR` entry into `xdr.SorobanAuthorizationEntry`, set `SorobanData.ResourceFee = MinResourceFee`, rebuild the tx with those attached (`txnbuild.NewTransaction` auto-sums the classic + resource fee once `Ext.SorobanData` is set), sign, submit, poll `GetTransaction` for `SUCCESS`/`FAILED`.
3. **`Address` arguments need to handle both G- and C- prefixed strkeys.** Soroban's `Address` type is polymorphic over accounts and contracts; naively assuming every address argument is a `G...` account address broke on the `token` argument to `initialize` (a `C...` contract address) — see `addressArg()`, which tries `AddressToAccountId` first and falls back to a contract address.
4. **A contract's `CreateContract` return value is recoverable from the simulation response** (`Results[0].ReturnValueXDR`, an `ScVal` of type Address) — no need to hand-derive the CAP-46 contract-id-from-preimage hash to know what address was just created.

## How to run

Requirements: Go 1.26+, the K01 wasm already built (`cd ../k01-soroban-escrow && cargo build --target wasm32v1-none --release`).

```bash
# from spikes/k02-go-soroban/
go mod tidy
go run .
```

No `soroban-cli`/`stellar-cli` needed for this spike — the whole point is that Go can do it independently.

## Next step

K02 is done. Per `server-build-plan.md`'s own sequencing, **K03** (wallet compatibility check) and **K04** (ADRs from K01–K03 findings) are next; **S01** (monorepo scaffold) shouldn't start before K04 folds these findings in.
