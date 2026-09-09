# core-go

Go backend: event/prize state machine, participant registration, real-time tracking, transaction pipeline, reconciliation.

## Status

`S01` (module scaffold) done — builds, runs, `GET /healthz` returns 200. Everything else is still ahead: `S02` (CI), `S03` (Postgres schema), `S04` (env config), `E01-E06` (business logic). See [docs/build-plan.md](../../docs/build-plan.md).

## Run locally

```bash
go run .
# optional: PORT=8091 go run .
curl localhost:8080/healthz
```

## Build

```bash
go build .
go vet ./...
```

## `internal/escrow` — Soroban transaction pipeline

`E01a` (done): a reusable, tested simulate → attach footprint/fee/auth →
sign → submit → poll pipeline for Soroban contract invocations, ported from
the `k02-go-soroban` spike. `escrow.Submit` takes a built `xdr.HostFunction`
and returns a confirmed `escrow.Result` or one of four typed errors
(`*SimulationError`, `*SubmissionError`, `*OnChainError`, `*TimeoutError`),
so callers can branch on which stage failed. `escrow.EncodeAddress` handles
both G-address (account) and C-address (contract) arguments — the fix for a
bug the spike hit on the `token` argument to `initialize`.

`E01b` (done): argument encoding and call-building for the three
`AdminWallet` operations — `deposit_funds`, `withdraw_funds`, `create_event`
— plus the read-only `get_balance`, in `wallet.go`. One event carries a
single `reward: i128` and a caller-supplied `event_id` (16 raw bytes,
`escrow.EventID`); the winners list belongs to `release_reward`, a later
issue, not to `create_event`.

Astrea is non-custodial, so `deposit_funds`/`withdraw_funds`/`create_event`
(all organizer-authorized) go through a build-only path instead of
`Submit`'s sign-and-submit-in-one-shot: `escrow.BuildDepositFunds` /
`BuildWithdrawFunds` / `BuildCreateEvent` simulate and attach the footprint,
then hand back an `escrow.UnsignedTx` — this service never sees the
organizer's key. Once the organizer's own wallet signs that envelope,
`escrow.SubmitSigned` submits it and polls for confirmation, the same as the
second half of `Submit`. `Submit` itself is unchanged and still exists for
flows (like the testnet proof below) that hold the signing key directly.
`escrow.GetBalance` reads the organizer's free balance via simulation only —
it never builds an auth entry and never submits anything. (The contract
deducts a new event's reward from the wallet at `create_event` time, so this
already is the free balance — there's no separate reserved figure.)

```bash
go test ./internal/escrow/...
```

A manual, network-touching harness proves the pipeline against the real
`event-escrow` contract deployed to testnet in `E03`
(`smart-contracts/astrea/contracts/event-escrow/README.md`). It's a `main`,
not a `go test`, so CI's `go test ./...` never depends on testnet/friendbot
being up. It exercises both signing paths: `deposit_funds` via `Submit`,
then `create_event` via `BuildCreateEvent` → (harness signs, standing in for
the organizer's wallet) → `SubmitSigned`, then reads the balance and the
event back:

```bash
go run ./cmd/escrow-testnet-proof
```
