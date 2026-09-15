# apps/web

Next.js front end. Setup, environment variables and the wallet requirements
are in the [repository README](../../README.md); `.env.example` here is the
authoritative list of variables with notes on each.

## Running the vertical slice locally

The public event page (`/[locale]/events/[id]`), registration and the judge
release page (`/[locale]/events/[id]/judge`) drive `services/core-go` for
every contract operation (issue #15, decision 1). To run them end to end
you need Go, a local Postgres, and a wallet extension.

1. **Postgres.** A local instance with this app's Prisma migrations applied:

   ```bash
   cd apps/web && npx prisma migrate deploy
   ```

   Go reads the same database directly. Give it the direct URL (port 5432,
   no `pgbouncer=true`) — see `services/core-go/README.md` "Configuration".

2. **Go, on `develop`.** From `services/core-go`, with `ESCROW_CONTRACT_ID`
   set to the same contract as `NEXT_PUBLIC_ESCROW_CONTRACT_ID` here and
   `CORE_GO_SERVICE_TOKEN` generated once (`openssl rand -hex 32`):

   ```bash
   cd services/core-go && go run .
   ```

   It listens on `PORT` (default `8080`).

3. **This app.** In `apps/web/.env`, alongside the variables the root README
   describes:

   ```dotenv
   CORE_GO_URL=http://localhost:8080
   CORE_GO_SERVICE_TOKEN=<the same value Go boots with>
   ```

   The token must be identical in both `.env` files — Go compares it in
   constant time and answers `401 unauthorized` otherwise. It is server-only
   here: never `NEXT_PUBLIC_`, never logged, never passed to a client
   component. Then `npm run dev`.

4. **An event.** Create one on-chain with `services/core-go/cmd/escrow-testnet-proof`
   (or the `stellar` CLI against the contract), then seed a `LIVE` `Event`
   row whose `escrowEventId` is that event's 32-hex id, its `Prize` rows,
   and one `ACTIVE` `Judge` whose wallet you control in the browser
   extension. The public page reads the reserved amount from the contract
   (`get_event`), so the on-chain event must exist before the row does.

5. **The flow.** Open `/en/events/<id>`: connect a wallet, register (a wallet
   without a USDC trustline is refused before any row is written), connect
   the organizer wallet and close registration, then open
   `/en/events/<id>/judge` with the judge wallet, assign a team per prize,
   build, sign, and watch the hash land. Go logs `/release/build` and
   `/release/submit` per request.

Nothing in the browser ever holds the service token or calls Soroban RPC
for a write; the one direct RPC call is the read-only `get_event`
simulation in `src/lib/escrow/read-event.ts`.
