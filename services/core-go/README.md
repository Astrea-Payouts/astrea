# core-go

Go backend: event/prize state machine, participant registration, real-time tracking, transaction pipeline, reconciliation.

## Status

`S01` (module scaffold) and `S04` (env config) done — builds, runs, `GET /healthz` returns 200, and refuses to start with missing/malformed config (see Configuration below). Everything else is still ahead: `S02` (CI), `S03` (Postgres schema), `E01-E06` (business logic). See [docs/build-plan.md](../../docs/build-plan.md).

## Run locally

Requires `ESCROW_CONTRACT_ID` at minimum — see Configuration below and
`.env.example`.

```bash
ESCROW_CONTRACT_ID=<your-testnet-contract-id> go run .
# optional: PORT=8091 ESCROW_CONTRACT_ID=<...> go run .
curl localhost:8080/healthz
```

## Build

```bash
go build .
go vet ./...
```

## Configuration

`S04` (done): `internal/config.Load` validates five environment variables —
`STELLAR_NETWORK`, `ALLOW_MAINNET`, `SOROBAN_RPC_URL`, `ESCROW_CONTRACT_ID`,
`PORT` — and `main` calls it before building the mux, so a missing or
malformed variable fails the process at boot (non-zero exit, one line per
problem) instead of surfacing as a confusing error on the first real
request. See `.env.example` for what each variable means and its default.

The network passphrase is derived from `STELLAR_NETWORK` via
`github.com/stellar/go/network`'s constants, never a separate variable —
letting the two drift is exactly the testnet/mainnet mix-up
`apps/web/src/lib/env.ts` also guards against. `ESCROW_CONTRACT_ID` is
validated by decoding it with `internal/escrow.ContractAddress` (real
strkey/checksum validation, not a regex) rather than re-implementing that
parsing here. `ALLOW_MAINNET` mirrors the web app's gate: setting
`STELLAR_NETWORK=mainnet` alone is refused.

**Key handling.** This service holds no signing key, plaintext or
otherwise. Organizer and judge keys never leave their own wallets — every
organizer-authorized call (`deposit_funds`, `withdraw_funds`,
`create_event`, and, added for `E01d`, the two go-live transitions) goes
through the build-only path (`escrow.UnsignedTx`), and
`release_reward`/`release_compensation` require the judge's own signature
the same way. `E01d` adds build-only wrappers for `resolve_dispute` and
`emergency_withdraw` too, but the resolver's key still never enters this
service: `resolve_dispute` is resolver-signed exactly like
`release_reward` is judge-signed, and `emergency_withdraw`'s two-signature
requirement is satisfied by handing the *other* party's pending auth
entry (`UnsignedTx.PendingAuth`) to `escrow.SignAuthEntry` — a function
that exists so a real wallet can compute the exact bytes it needs to sign
client-side, not so this service can sign on the resolver's behalf.
Emergency-admin-only governance calls (`initialize_default_resolver`,
`initialize_treasury`, `set_paused`, and friends) are still used directly
from the `stellar` CLI by a human operator holding the governance keys —
this service never touches them either. The treasury is a receive-only
address, not a signer. The one key this service will eventually hold is a fee payer for
permissionless `expire_event` submissions (anyone can trigger a timed-out
event's refund; something has to pay the network fee) — by construction
it's low-value, holding fee dust only, and its `_FILE`-style indirection
and log-redaction handling is deferred to the issue that introduces that
job, not decided speculatively here.

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

`E01d` (done): `resolve_dispute`, the two-signature `emergency_withdraw`,
and the two go-live state transitions, in `lifecycle.go` —
`set_event_waiting_for_start`/`set_event_in_progress` (the latter now
takes a `judging_deadline: u64` and charges a go-live fee out of the
organizer's free balance, quoted beforehand with the read-only
`QuoteGoLiveFee`) and `resolve_dispute` (resolver-signed, reusing
`release_reward`'s exact `Winner` shape — it's the same
"pay `event.reward` out to arbitrary addresses" primitive, just callable
by the resolver instead of the judge, and only once `InProgress` and past
`judging_deadline`). `emergency_withdraw` is this package's first call
needing *two* independent signatures (admin's and the resolver's), which
is what `auth.go` exists for: `BuildUnsigned` (`pipeline.go`) now surfaces
any simulated `SOROBAN_CREDENTIALS_ADDRESS` auth entry that isn't the
transaction's own source account as `UnsignedTx.PendingAuth`, each with a
`SignatureExpirationLedger` set ~100 ledgers (~8-10 minutes) out from the
simulated ledger; `escrow.SignAuthEntry` computes the exact preimage hash
the Soroban host checks (`sha256` of a
`HashIdPreimage{type: ENVELOPE_TYPE_SOROBAN_AUTHORIZATION, ...}`) and
signs it in the `{public_key, signature}` shape the built-in account
contract's `__check_auth` expects; `escrow.AttachSignedAuth` folds a
signed entry back into the envelope, matched by nonce + address. A fixed
preimage vector is asserted byte-for-byte in `auth_test.go`, not just
"no error" — and a `SOROBAN_CREDENTIALS_SOURCE_ACCOUNT` entry is asserted
to never appear in `PendingAuth`, since the envelope's own signature
already satisfies that kind of entry implicitly.

```bash
go test ./internal/escrow/...
```

A manual, network-touching harness proves the pipeline against a real
`event-escrow` contract on testnet, read from `ESCROW_CONTRACT_ID` (see
Configuration above — `E01d` dropped the harness's old hardcoded contract
id in favor of `internal/config.Load`, since a contract built before
`E01d`'s own contract-side prerequisites, PRs #178/#179, can't run these
scenarios at all). It's a `main`, not a `go test`, so CI's `go test ./...`
never depends on testnet/friendbot being up. It exercises both signing
paths: `deposit_funds` via `Submit`, then `create_event` via
`BuildCreateEvent` → (harness signs, standing in for the organizer's
wallet) → `SubmitSigned`, then reads the balance and the event back (`A`);
drives a second event to `InProgress` and closes it with `release_reward`
to a 3-member team on an uneven 3333/3333/3334 bp split so the remainder
rule fires on a real ledger, not just in a unit test (`B`); cancels a
third event pre-launch (`C`); proves against the contract itself, not
asserted client-side, that a fourth event's cancellation is rejected once
it reaches `InProgress` (`D`); drives a fifth event `InProgress` with a
~45s `judging_deadline`, proves the judge is rejected from calling
`resolve_dispute`, waits out the deadline, and has the resolver settle it
by paying a team member and the organizer's own address in one call —
`resolve_dispute`'s "cancel-after-launch" pattern (`E`); runs the full
two-signature `emergency_withdraw` happy path, with the resolver's pending
auth entry signed via `SignAuthEntry` entirely client-side and folded back
in with `AttachSignedAuth` (`F`); and submits the identical
`emergency_withdraw` call with only the admin's envelope signature, which
the host rejects (`InvokeHostFunction` trapped) rather than this package
catching it beforehand (`G`):

```bash
ESCROW_CONTRACT_ID=<your-testnet-contract-id> go run ./cmd/escrow-testnet-proof
```
