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

Not wired into `main.go` yet — that's for the operations built on top of it
(`E01b`/`E01c`/`E01d`, deposit/withdraw/create/cancel/release).

```bash
go test ./internal/escrow/...
```

A manual, network-touching harness proves the pipeline against the real
`event-escrow` contract deployed to testnet in `E03`
(`smart-contracts/astrea/contracts/event-escrow/README.md`). It's a `main`,
not a `go test`, so CI's `go test ./...` never depends on testnet/friendbot
being up:

```bash
go run ./cmd/escrow-testnet-proof
```
