# core-go

Go backend: event/prize state machine, participant registration, real-time tracking, transaction pipeline, reconciliation.

## Status

`S01` (module scaffold) done — builds, runs, `GET /healthz` returns 200. `E01a` (shared simulate→sign→submit→poll pipeline) lives in `internal/escrow`. Still ahead: `S02` (CI), `S03` (Postgres schema), `S04` (env config), `E01b-E06`. See [docs/build-plan.md](../../docs/build-plan.md).

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
