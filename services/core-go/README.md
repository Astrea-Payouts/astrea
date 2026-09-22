# core-go

Go backend: event/prize state machine, participant registration, real-time tracking, transaction pipeline, reconciliation.

## Status

`S01` (module scaffold) and `S04` (env config) done — builds, runs, `GET /healthz` returns 200, and refuses to start with missing/malformed config (see Configuration below). `#185 PR 1` adds a Postgres store (`internal/store`), the service-to-service auth middleware, and the router (`internal/api`). `#185 PR 2` (done) adds the judge release path — `POST /events/{id}/release/build` and `POST /events/{id}/release/submit` — see [Release path](#release-path) below. `#11 PR 1` (done) adds the organizer path's wallet and create_event endpoints — `GET /wallets/{address}/balance`, `POST /wallets/{address}/deposit/build|submit`, `POST /events/{id}/create/build|submit`. `#11 PR 2` (done) adds the go-live endpoints — `GET /events/{id}/start/quote`, `POST /events/{id}/start/build|submit` — the only code path that moves an event `CREATED -> LIVE`; see [Organizer path](#organizer-path) below for the full contract. Everything else is still ahead: `S02` (CI), the rest of `E01-E06`. See [docs/build-plan.md](../../docs/build-plan.md).

## Run locally

The service reads plain environment variables. It does **not** load a
`.env` file, so a filled-in `services/core-go/.env` does nothing on its own:
you load it into the shell first, then start the process. That is why
`go run .` reports `ESCROW_CONTRACT_ID: required` and friends even when the
file is complete.

1. Copy `.env.example` to `.env` and fill in the blanks (see Configuration
   below for what each variable means).

   - `DATABASE_URL`: the same database `apps/web`'s Prisma migrations run
     against. Either a local Postgres with those migrations applied, or
     Supabase's **session** pooler (port `5432` on
     `aws-0-<region>.pooler.supabase.com`, the URL `apps/web/.env.example`
     uses as `DIRECT_URL`). Not `db.<project-ref>.supabase.co` (IPv6 only,
     so an IPv4-only network cannot reach it) and not `apps/web`'s runtime
     URL with `?pgbouncer=true` (refused at boot). There is no in-memory
     fallback.
   - `CORE_GO_SERVICE_TOKEN`: at least 32 bytes, and the **same value** as
     `apps/web`'s `CORE_GO_SERVICE_TOKEN`. Generate one with
     `openssl rand -hex 32`, or in PowerShell:

     ```powershell
     $b = New-Object byte[] 32
     [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
     ($b | ForEach-Object { $_.ToString('x2') }) -join ''
     ```

   - `ESCROW_CONTRACT_ID`: the deployed testnet contract (the one
     `apps/web` points at).

2. Load `.env` into the current shell and start the server.

   bash / Git Bash:

   ```bash
   set -a; source .env; set +a
   go run .
   ```

   PowerShell:

   ```powershell
   Get-Content .env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
     $name, $value = $_ -split '=', 2
     Set-Item -Path "Env:$($name.Trim())" -Value $value.Trim().Trim('"')
   }
   go run .
   ```

   Variables set this way live in that shell session only; run the loader
   again in a new terminal.

3. Check it is up. On PowerShell use `curl.exe`: bare `curl` is an alias
   for `Invoke-WebRequest` and prompts for arguments.

   ```bash
   curl -i localhost:8080/healthz                          # 200
   curl -i localhost:8080/events/<event-id>/release/build  # 401 — no bearer
   curl -i localhost:8080/events/<event-id>/release/build \
     -X POST \
     -H "Authorization: Bearer $CORE_GO_SERVICE_TOKEN" \
     -H "X-Astrea-Wallet: G..." \
     -H "Content-Type: application/json" \
     -d '{"assignments":[{"rank":1,"teamId":"..."}]}'
   ```

4. Point `apps/web` at it: `CORE_GO_URL=http://localhost:8080` in
   `apps/web/.env`, with the shared `CORE_GO_SERVICE_TOKEN`.

## Deploy (Vercel)

`vercel.json` sets the `go` framework preset: Vercel builds `main.go` and
runs it as a plain `net/http` server on the `PORT` it injects, on Fluid
compute (300 s max per request on Hobby — the 30 s confirmation poll in
`/submit` fits). The Vercel project's *Root Directory* is `services/core-go`,
so `go.mod` is at its root as the preset requires.

Instances are reused but can scale out, so `DATABASE_URL` must be Supabase's
transaction pooler (port `6543`), never the direct one. Two things differ
from `apps/web`'s copy of that URL: drop `?pgbouncer=true` (pgx forwards it
as a server setting and Postgres refuses it) and add
`?default_query_exec_mode=exec`, because the transaction pooler does not
keep named prepared statements between requests — pgx's default mode fails
with `SQLSTATE 26000`. The other two modes that survive a pooler are worse
fits: `simple_protocol` breaks the `jsonb` payload writes with
`SQLSTATE 22P02`, and `describe_exec` is unsafe here by pgx's own
documentation, because it describes and executes in separate round trips
that transaction pooling can route to different server connections
(`pgx@v5.11.0/doc.go`, "PgBouncer"). `PORT` is set by Vercel; every other
variable from Configuration below is set in the project's environment
variables. `apps/web` then points `CORE_GO_URL` at the deployment and shares
`CORE_GO_SERVICE_TOKEN`.

## Build

```bash
go build .
go vet ./...
```

## Configuration

`S04` (done): `internal/config.Load` validates eight environment variables —
`STELLAR_NETWORK`, `ALLOW_MAINNET`, `SOROBAN_RPC_URL`, `ESCROW_CONTRACT_ID`,
`PORT`, `DATABASE_URL`, `CORE_GO_SERVICE_TOKEN`, `USDC_ISSUER` — and `main` calls it before
opening the database pool or building the mux, so a missing or malformed
variable fails the process at boot (non-zero exit, one line per problem)
instead of surfacing as a confusing error on the first real request. See
`.env.example` for what each variable means and its default.

The network passphrase is derived from `STELLAR_NETWORK` via
`github.com/stellar/go/network`'s constants, never a separate variable —
letting the two drift is exactly the testnet/mainnet mix-up
`apps/web/src/lib/env.ts` also guards against. `ESCROW_CONTRACT_ID` is
validated by decoding it with `internal/escrow.ContractAddress` (real
strkey/checksum validation, not a regex) rather than re-implementing that
parsing here. `ALLOW_MAINNET` mirrors the web app's gate: setting
`STELLAR_NETWORK=mainnet` alone is refused.

**`DATABASE_URL`.** This service reads Postgres directly (`internal/store`,
`github.com/jackc/pgx/v5` — hand-written SQL, no ORM); Prisma (`apps/web`)
keeps sole ownership of every migration. Which connection string to use
depends on where this service runs:

- **Locally**: a local Postgres, or Supabase's **session** pooler (port
  `5432`, the URL `apps/web/.env.example` uses as `DIRECT_URL`). Not
  `db.<project-ref>.supabase.co` — it publishes an AAAA record and no A
  record, so an IPv4-only network cannot reach it without Supabase's paid
  IPv4 add-on.
- **On Vercel**: the **transaction** pooler (port `6543`) with
  `?default_query_exec_mode=exec`, because instances scale out and the
  pooler does not keep named prepared statements between requests. Not
  `describe_exec` — see "Deploy (Vercel)" above for why that mode is unsafe
  behind a transaction pooler.

What never works in either case is `apps/web`'s runtime URL as-is: pgx
forwards `?pgbouncer=true` to Postgres as a server runtime setting, which
Postgres refuses outright. `Load` parses the URL with
`pgxpool.ParseConfig` and refuses to boot if `pgbouncer=true` is present,
rather than failing confusingly on the first query. Nothing enforces a
port, so the two cases above are conventions, not validation.

**`CORE_GO_SERVICE_TOKEN`.** A shared secret this service and `apps/web`
both hold, at least 32 bytes. `apps/web` sends it as
`Authorization: Bearer <token>` on every call, alongside `X-Astrea-Wallet`
for the session's wallet address (`apps/web` authenticates via its own
SEP-0043 session; this service only authorizes the service-to-service call
and checks the wallet is a real Stellar account address — see
`internal/api/auth.go`). Never logged.

**`USDC_ISSUER`.** The classic-asset issuer account of the organizer path's
deposit token. `main` derives the token's Soroban Asset Contract (SAC)
address from this plus the network passphrase via
`internal/escrow.ClassicAssetContractID` once at boot — the SAC address
itself is never configured directly, so it can never drift out of step
with `STELLAR_NETWORK`.

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

## `internal/store` — Postgres reads and writes

`#185 PR 1` (done): `Store.LoadEventForRelease` is the one query the
`/release/build` handler needs, in one round trip per table — the event,
its ACTIVE judges, its prizes ordered by rank, and its teams with members
(ordinal, share, wallet address). Hand-written SQL over
`github.com/jackc/pgx/v5`/`pgxpool`, no ORM, no code generator — Prisma
(`apps/web`) keeps sole ownership of every migration; this package only
reads and writes rows. Tables are snake_case (Prisma's `@@map`) but columns
are camelCase and unrenamed, so every identifier in the SQL is
double-quoted (`"escrowEventId"`, `"shareBasisPoints"`), and every uuid
column read back is cast `::text` in the query itself — pgx's binary uuid
codec doesn't scan into a plain Go string, but the ordinary text codec
does. `Prize.Amount` stays the exact `Decimal(18,7)` text Postgres renders,
untouched: the Decimal→i128 conversion happens in `internal/escrow` (see
`AmountToStroops` below).

`#185 PR 2` (done): the release path's writes, in `postgres_release.go` —
`SaveReleaseBuild`, `LoadReleaseOp`, `MarkReleaseSucceeded`,
`MarkReleaseFailed`. Each write method opens and commits its own
transaction (`Postgres.begin`, a `txBeginner` interface kept separate from
the read-only `querier` one so PR 1's existing fake-based unit tests keep
compiling unchanged); `SaveReleaseBuild` re-checks inside that transaction
that the event is still `JUDGING` and that every prize the build names
still belongs to it, closing the race window a handler's own
`LoadEventForRelease` read can't see past. The `op_log` row's
`idempotencyKey` is always `<eventId>:release_reward` — one row per event,
ever — upserted with an `INSERT ... ON CONFLICT ... WHERE status <>
'SUCCEEDED'` so a rebuild after a paid-out release is refused
(`ErrAlreadySucceeded`) without a separate read-then-write step.
`postgres_test.go`/`postgres_release_test.go` are gated integration tests
(`t.Skip` unless `TEST_DATABASE_URL` is set — see CI's core-go job for the
Postgres service container that sets it) that seed rows and roll every
transaction back at the end.

`#11 PR 1` (done): the organizer path's own writes, in
`postgres_organizer.go` — `SaveCreateBuild`/`LoadCreateOp`/
`MarkCreateSucceeded`/`MarkCreateFailed` (idempotency key
`<eventId>:create_event`) and `SaveDepositBuild`/`LoadDepositOp`/
`MarkDepositSucceeded`/`MarkDepositFailed` (key `deposit_funds:<opId>`,
freshly generated per call — deposits repeat, unlike the other two op_log
rows in this file, so there is no existing row to upsert).

`#11 PR 2` (done): `LoadEventForStart`/`SaveStartBuild`/`LoadStartOp`/
`MarkStartSucceeded`/`MarkStartFailed`, also in `postgres_organizer.go`
(idempotency key `<eventId>:set_event_in_progress`). `MarkStartSucceeded`
is, by construction, the only place in the service that writes
`Event.status = LIVE` (issue #11 decision 6) — one transaction does both:
an `op_log` `PENDING -> SUCCEEDED` update conditioned on the row still
naming the exact `hostFunctionXdr` that was confirmed (`ErrStartBuildReplaced`
on a mismatch or a non-`PENDING` row — closes the window where a rebuild
mid-submit could otherwise confirm a stale build), then, only if that
matched, an `events` `CREATED -> LIVE` update conditioned on the current
status (a generic race error on 0 rows — a second, would-be identical
transition never silently no-ops). `TestOnlyOneSQLStatementWritesLive`
(`internal/api`) backs the "only writer" claim with a repo-wide scan
rather than trusting the comment. `postgres_organizer_test.go`'s
`TestPostgres_StartWrites` covers this sequentially, the same
seed-then-roll-back pattern as every other gated test here; genuine
concurrent confirmation is different in kind, not degree, from a
sequential retry, so it gets its own file:
`postgres_start_race_test.go`'s `TestMarkStartSucceeded_RealConcurrency`
opens a real pool and a separate connection, seeds and *commits* real
rows (there is no shared outer transaction to roll back when two
goroutines must race across two genuinely separate ones), fires two
goroutines at the same `PENDING` build, and asserts on Postgres's own
MVCC guarantee: the loser's `UPDATE` blocks on the winner's row lock, then
re-evaluates its `WHERE` clause once that lock releases and finds the row
already `SUCCEEDED` — so the outcome is deterministic (one `nil`, one
`ErrStartBuildReplaced`), not a coin flip, and the test cleans up its own
rows explicitly afterward instead of relying on a rollback.

## `internal/api` — router, service auth, and the release path

`#185 PR 1` (done): `router.go` mounts `GET /healthz` unauthenticated and
everything else behind `RequireAuth`. `auth.go` checks the
`Authorization: Bearer` header with a constant-time compare
(`crypto/subtle`) and validates `X-Astrea-Wallet` as a real Stellar account
address with `strkey.Decode(strkey.VersionByteAccountID, ...)`, putting the
wallet on the request context (`WalletFrom`) for handlers to read.
`errors.go` is the one JSON error shape every failure uses:
`{"error":{"code":"...","message":"..."}}`.

`#185 PR 2` (done): `release.go`'s `POST /events/{id}/release/build` and
`POST /events/{id}/release/submit` — see [Release path](#release-path)
below for the full contract. The placeholder `GET /whoami` PR 1 shipped to
exercise `RequireAuth` end to end is gone; these two handlers are the real
thing.

`#11 PR 1` (done): the organizer path's own build/submit pairs, on the
same envelope-comparison trust boundary as `release.go` (`envelope.go`'s
`verifySignedEnvelope`, shared rather than duplicated). `wallet.go` adds
`GET /wallets/{address}/balance` (a read-only simulate, no `op_log` row)
and `POST /wallets/{address}/deposit/build|submit`. `create.go` adds
`POST /events/{id}/create/build|submit` — reward is always
`sum(Prize.amount)`, never client-supplied, and a successful submit moves
the event `DRAFT -> CREATED` ("startable"), never straight to `LIVE`.

`#11 PR 2` (done): `start.go` adds the go-live endpoints —
`GET /events/{id}/start/quote`, `POST /events/{id}/start/build|submit` —
the same build-only-then-compare shape as every other write pair in this
package. Unlike `create.go`/`release.go`, `/start/submit` has its own
precondition function (`checkStartSubmitPreconditions`) rather than
sharing `checkStartPreconditions` with `/start/quote` and `/start/build`:
a `SUCCEEDED` `op_log` row must win over the event's now-`LIVE` status, so
a second, redundant submit for an already-confirmed build reports
`409 start_already_succeeded` rather than the generic `event_not_created`
a stranger sees. The full organizer-path contract — every endpoint,
status code, and `op_log` transition — lives in
[Organizer path](#organizer-path) below, not here.

## Release path

`#185 PR 2` (done). The judge who owns an event's single `ACTIVE` `Judge`
row calls these two endpoints, in order, to pay out `release_reward` —
both require the shared bearer token and `X-Astrea-Wallet` set to that
judge's address (see Configuration above). Neither request or response
body ever carries a payout amount: amounts live only in
`internal/store`/Postgres and in the signed transaction itself.

### `POST /events/{id}/release/build`

Request:

```json
{"assignments": [{"rank": 1, "teamId": "<uuid>"}]}
```

One assignment per prize `rank` on the event, each naming the `Team` that
won it — never an amount; `Prize.amount` (organizer-set at creation) and
`TeamMember.shareBasisPoints` (set at registration) are what determine
each member's payout. The handler loads the event, allocates winners with
`escrow.AllocateWinners` (the remainder rule: a position's leftover stroop
after flooring every member's basis-point share goes to the team's
lowest-`Ordinal` member), simulates `release_reward` for the judge's own
wallet to sign, and persists the result as the event's `op_log` row.

Response (`200`):

```json
{
  "eventId": "<uuid>",
  "unsignedTransactionXdr": "AAAA...",
  "winners": [
    {"rank": 1, "teamId": "<uuid>", "teamMemberId": "<uuid>", "address": "G..."}
  ]
}
```

The judge's own wallet signs `unsignedTransactionXdr` (e.g.
`stellar tx sign --sign-with-key <judge> --network testnet`) and hands the
result to `/release/submit`.

### `POST /events/{id}/release/submit`

Request:

```json
{"signedTransactionXdr": "AAAA..."}
```

Before ever calling the RPC, the handler re-derives and compares this
signed envelope against what `/release/build` stored
(`escrow.DecodeSingleOpInvokeHostFunction`, the same single-op
`InvokeHostFunction` guard `AttachSignedAuth` has always used): it must be
a V1, single-operation envelope; carry at least one signature; have a
source account equal to the judge who built this release; and its
`InvokeHostFunction`'s host function must marshal to exactly the bytes
`/release/build` persisted. Any mismatch is refused as `409
envelope_mismatch` with no RPC call made at all — see Guarantee below.
Once it passes, the envelope is submitted (`escrow.SubmitSigned`) and
polled for confirmation.

Response (`200`, on-chain success):

```json
{"txHash": "...", "status": "succeeded"}
```

Response (`202`, `escrow.TimeoutError` — outcome unknown, not failed; the
`op_log` row stays `PENDING` and a later `/release/submit` retry or manual
reconciliation still has it to work with):

```json
{"txHash": "...", "status": "pending"}
```

### Status codes

Every error body is `{"error":{"code":"...","message":"..."}}`.

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `unauthorized` | missing/invalid bearer token (middleware) |
| 400 | `invalid_wallet` | `X-Astrea-Wallet` isn't a Stellar account address (middleware) |
| 400 | `invalid_request` | malformed JSON body, or empty `assignments`/`signedTransactionXdr` |
| 404 | `event_not_found` | no event with that id — including a path id that isn't a well-formed UUID, rejected before ever reaching a query, since a raw `WHERE id = $1` against a `uuid` column would otherwise surface a Postgres syntax error as a `500` |
| 403 | `not_judge` | caller's wallet isn't the event's judge |
| 409 | `event_not_judging` | `Event.status` isn't `JUDGING` |
| 409 | `event_not_on_chain` | `Event.escrowEventId` is null |
| 409 | `judge_ambiguous` | the event doesn't have exactly one `ACTIVE` judge |
| 409 | `assignments_invalid` | a rank missing, duplicated, or unknown; a team from another event; or a team assigned twice |
| 409 | `allocation_failed` | `escrow.AllocateWinners` rejected the split (wraps `*escrow.AllocationError`) |
| 409 | `release_already_succeeded` | this event's release already paid out |
| 409 | `no_pending_release` | `/release/submit` called with no currently-`PENDING` build (never built, or the last build's submit already failed and needs a fresh `/release/build`) |
| 409 | `envelope_mismatch` | the signed envelope doesn't match what `/release/build` produced (decision below) |
| 502 | `simulation_failed` | RPC simulation of `release_reward` failed (`/release/build`) |
| 502 | `submission_failed` | stellar-core rejected the transaction at submission (`/release/submit`; marks the op `FAILED`) |
| 502 | `on_chain_failed` | the transaction landed but executed with an error (`/release/submit`; marks the op `FAILED`) |
| 500 | `internal` | anything else — logged with the event id, never the request body |

### `op_log` status and who moves it

`SaveReleaseBuild` upserts the row to `PENDING` (idempotency key
`<eventId>:release_reward` — one row per event, ever) and assigns every
named prize's `winnerTeamId`/`status=ASSIGNED`, all in one transaction.
`MarkReleaseSucceeded` moves `PENDING → SUCCEEDED`: every prize the build
named goes to `RELEASED` with the same `releaseTxHash`, one `Payout` row
per winning `TeamMember` (all sharing that hash), and `Event.status →
COMPLETED` — also one transaction. `MarkReleaseFailed` moves the row to
`FAILED` and merges the failure reason into its payload under
`"lastError"`, leaving prizes `ASSIGNED` so a fresh `/release/build` can
overwrite the row and try again. A `*escrow.TimeoutError` moves nothing —
the row stays `PENDING`, since the outcome is genuinely unknown, not
failed.

### Guarantee

Astrea never holds a judge's key, so nothing stops a judge's wallet from
signing something other than what `/release/build` asked it to. The
split enforced by `escrow.AllocateWinners` — one prize per team, shares
summing to exactly 10000 bp, the remainder rule — is therefore an
off-chain guarantee, not an on-chain one: the `event-escrow` contract
itself only asserts that `release_reward`'s winner amounts sum to
`Event.reward`, nothing about how that sum is split. What makes the
off-chain guarantee real is `/release/submit`'s byte-for-byte comparison
of the signed envelope's host function against the one `/release/build`
simulated and persisted (`409 envelope_mismatch` on any difference, before
any RPC call): a judge's wallet cannot silently submit a different split
than the one this service computed and showed it, because the two are
checked to be identical, not merely trusted to be.

## Organizer path

`#11 PR 1`/`PR 2` (both done). The organizer named on `Event.organizerWalletId`
calls these endpoints, in order, to fund their wallet, put an event
on-chain, and then take it live — all behind the shared bearer token and
`X-Astrea-Wallet` set to the organizer's own address (see Configuration
above). Every build/submit pair sits on the same trust boundary as the
[Release path](#release-path): `/build` simulates and persists a
`hostFunctionXdr`; `/submit` re-derives and byte-for-byte compares the
signed envelope against it (`envelope.go`'s `verifySignedEnvelope`) before
ever calling the RPC, so an organizer's wallet cannot silently sign
something other than what this service showed it.

### `GET /wallets/{address}/balance`

Read-only simulation, no `op_log` row. `{address}` must equal the caller's
own `X-Astrea-Wallet`.

Response (`200`):

```json
{"address": "G...", "balance": "1500000000"}
```

### `POST /wallets/{address}/deposit/build`

Request:

```json
{"amount": "150.0000000"}
```

Simulates `deposit_funds` for `amount` (capped at 1,000,000 USDC,
`Decimal(18,7)` text converted to stroops via `escrow.AmountToStroops`)
and persists a brand-new `PENDING` `op_log` row — deposits repeat, unlike
`create_event`/`set_event_in_progress`, so there is no existing row to
upsert.

Response (`200`):

```json
{"opId": "<32 hex chars>", "unsignedTransactionXdr": "AAAA..."}
```

### `POST /wallets/{address}/deposit/submit`

Request:

```json
{"opId": "<32 hex chars>", "signedTransactionXdr": "AAAA..."}
```

Response shape matches `/release/submit` (`{"txHash", "status"}` —
`"succeeded"` on `200`, `"pending"` on a `202` poll timeout).

### `POST /events/{id}/create/build`

No request body. The event must be `DRAFT`, have no `escrowEventId` yet,
at least one prize, and exactly one `ACTIVE` judge. Reward is always
`sum(Prize.amount)` — never client-supplied (issue #11 decision 2) — and a
fresh on-chain event id is minted on every call, even a rebuild.

Response (`200`):

```json
{"unsignedTransactionXdr": "AAAA...", "reward": 1500000000, "escrowEventId": "<32 hex chars>"}
```

### `POST /events/{id}/create/submit`

Request:

```json
{"signedTransactionXdr": "AAAA..."}
```

On confirmation, moves the event `DRAFT -> CREATED` — "startable", never
straight to `LIVE` (issue #11 decision 4). Response adds `escrowEventId`
to the usual `{"txHash", "status"}` shape.

### `GET /events/{id}/start/quote`

Read-only, no `op_log` row. The event must be `CREATED` with an
`escrowEventId` set. Reads the go-live fee (`escrow.QuoteGoLiveFee`) and
the organizer's free balance (`escrow.GetBalance`) via simulation only.

Response (`200`):

```json
{"fee": "500", "balance": "200", "shortfall": "300"}
```

All three are stroop strings; `shortfall` is `max(fee - balance, 0)` —
`/start/build` refuses with `409 insufficient_balance` below that same
threshold, so a caller can check affordability before ever building.

### `POST /events/{id}/start/build`

No request body. Beyond `/start/quote`'s two preconditions, the event's
`judgingDeadlineAt` must be set (`409 deadline_missing`) and in the future
(`409 deadline_past`), and the organizer's free balance must cover the
freshly quoted fee (`409 insufficient_balance` — the fee/balance/shortfall
are in the error message, not the opaque `simulation_failed` a raw
contract trap would otherwise surface). Simulates
`set_event_in_progress` with `judgingDeadlineAt` converted to Unix seconds
(`time.Time.Unix()` — location-independent, no timezone handling needed)
and persists the result as the event's single
`set_event_in_progress` `op_log` row (idempotency key
`<eventId>:set_event_in_progress` — one row per event, ever, upserted the
same way `create_event`'s is).

Response (`200`):

```json
{"unsignedTransactionXdr": "AAAA...", "judgingDeadline": 1780000000, "fee": 500}
```

### `POST /events/{id}/start/submit`

Request:

```json
{"signedTransactionXdr": "AAAA..."}
```

**The only code path in this service that moves an event `CREATED -> LIVE`**
(issue #11 decision 6) — `TestOnlyStartSubmitMovesEventLive` and
`TestOnlyOneSQLStatementWritesLive` (`internal/api/start_test.go`) back
that claim from two directions: running every other go-live endpoint
against an otherwise-eligible event never moves it off `CREATED`, and a
repo-wide scan of every non-test `.go` file under `internal/` finds the
literal SQL `'LIVE'` exactly once. On confirmation, `MarkStartSucceeded`
runs the two conditional updates described in
`internal/store` above; a
rebuild that replaces the `PENDING` row while an earlier submit's RPC call
is still in flight surfaces as `409 start_build_replaced`, not a silent
wrong-deadline confirmation.

Response shape matches `/release/submit`.

### Status codes

Every error body is `{"error":{"code":"...","message":"..."}}`. Only
organizer-path-specific codes are listed; `unauthorized`/`invalid_wallet`/
`event_not_found`/`internal`/`simulation_failed`/`submission_failed`/
`on_chain_failed`/`envelope_mismatch` mean the same thing they do on the
[Release path](#release-path).

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_amount` | deposit `amount` isn't a valid `Decimal(18,7)`, or exceeds the 1,000,000 USDC cap |
| 400 | `invalid_request` | malformed JSON body, or an empty `signedTransactionXdr`/`opId` shaped wrong |
| 403 | `not_wallet_owner` | `{address}` in the path isn't the caller's own `X-Astrea-Wallet` |
| 403 | `not_organizer` | caller's wallet isn't this event's organizer (create/start endpoints) |
| 404 | `deposit_not_found` | no deposit build with that `opId` |
| 409 | `event_not_draft` | `/create/*`: `Event.status` isn't `DRAFT` |
| 409 | `event_already_on_chain` | `/create/*`: `Event.escrowEventId` is already set |
| 409 | `no_prizes` | `/create/*`: event has no prizes to sum into a reward |
| 409 | `judge_ambiguous` | `/create/*`: event doesn't have exactly one `ACTIVE` judge |
| 409 | `create_already_succeeded` | this event's `create_event` already succeeded |
| 409 | `no_pending_create` | `/create/submit` with no currently-`PENDING` build |
| 409 | `create_build_replaced` | a rebuild overwrote the `PENDING` row while an earlier submit was in flight |
| 409 | `deposit_already_succeeded` | this deposit already succeeded |
| 409 | `no_pending_deposit` | the last deposit attempt failed — build again before submitting |
| 409 | `event_not_created` | `/start/*`: `Event.status` isn't `CREATED` |
| 409 | `event_not_on_chain` | `/start/*`: `Event.escrowEventId` is null |
| 409 | `deadline_missing` | `/start/build`: `Event.judgingDeadlineAt` is null |
| 409 | `deadline_past` | `/start/build`: `Event.judgingDeadlineAt` is not in the future |
| 409 | `insufficient_balance` | `/start/build`: organizer's free balance is short of the quoted fee |
| 409 | `start_already_succeeded` | this event has already gone live |
| 409 | `no_pending_start` | `/start/submit` with no currently-`PENDING` build |
| 409 | `start_build_replaced` | a rebuild overwrote the `PENDING` row while an earlier submit was in flight |

### `op_log` status and who moves it

Three independent idempotency keys, one op_log "lane" each:
`<eventId>:create_event`, `deposit_funds:<opId>` (freshly generated per
call, since deposits repeat), and `<eventId>:set_event_in_progress`. Each
follows the same shape: `/build` upserts `PENDING`; `/submit` moves it to
`SUCCEEDED` on confirmation or `FAILED` on a submission/on-chain error
(merging the reason into the payload under `"lastError"`); a
`*escrow.TimeoutError` moves nothing, since the outcome is genuinely
unknown. `set_event_in_progress`'s `SUCCEEDED` transition is the one
exception carrying a side effect beyond its own row: it also moves
`Event.status` `CREATED -> LIVE`, in the same transaction (see
`internal/store` above).

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

`#185 PR 2` (done): `amount.go` adds `AmountToStroops`/`StroopsToAmount`,
the exact (no floating point) conversion between `Prize.amount`'s
`Decimal(18,7)` text and stroops — exact because every SAC the contract's
`token` can name, native XLM or a wrapped classic asset, has exactly 7
decimals; a custom token with a different decimal count is out of scope,
noted on `AmountToStroops` itself. `wallet.go` adds `ParseEventID`, the
inverse of `EventID.String()`, for turning `Event.escrowEventId` back into
an `EventID` the contract calls expect. `auth.go`'s single-op
`InvokeHostFunction` decode — used internally by `AttachSignedAuth` since
PR 1 — is now the exported `DecodeSingleOpInvokeHostFunction`, so the
release path's `/submit` handler reuses the identical guard on a judge's
signed envelope instead of a second copy of the same decode logic.

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
