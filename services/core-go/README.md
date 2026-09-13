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

`E01c` (done): the four calls that end an event for good, in
`lifecycle.go` — `set_event_cancelled` and `expire_event` (the two refund
paths; `expire_event` alone has no signer at all, so its `Build...` takes a
plain fee-paying account instead of an organizer's address), and
`release_reward`/`release_compensation`, which pay out `Vec<Winner>`/
`Vec<Participants>`. Those two are this package's first arguments that are
structs rather than scalars or addresses, and Soroban encodes a
`#[contracttype]` struct as an `ScMap` keyed by field name in *sorted*
order — `{address, amount, place}` for `Winner`, not `Winner`'s declared
`{place, amount, address}` — so `lifecycle_test.go` asserts that exact key
sequence rather than trusting it implicitly. `allocate.go` adds
`escrow.AllocateWinners`, a pure function with no database or RPC access
that turns an organizer's per-position prizes and each position's winning
team into that flat `[]Winner` — one entry per `TeamMember`, all sharing
their position's `place` — applying the remainder rule
`schema.prisma`'s `TeamMember.shareBasisPoints` comment documents: a
position's leftover unit after flooring every member's basis-point share
goes to the team's lowest-`Ordinal` member, and any member a split floors
to zero is rejected before it ever reaches the contract (which would
otherwise reject the *entire* release).

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
event back — and, added for `E01c`, drives a second event to `InProgress`
and closes it with `release_reward` to a 3-member team on an uneven
3333/3333/3334 bp split (so the remainder rule fires on a real ledger, not
just in a unit test), cancels a third event pre-launch, and proves against
the contract itself — not asserted client-side — that a fourth event's
cancellation is rejected once it reaches `InProgress`:

```bash
go run ./cmd/escrow-testnet-proof
```
