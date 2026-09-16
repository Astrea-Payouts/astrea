# apps/web

Next.js front end. Setup, environment variables and the wallet requirements
are in the [repository README](../../README.md); `.env.example` here is the
authoritative list of variables with notes on each.

## Running the vertical slice locally

The organizer form (`/[locale]/organizer/new`), the fund & create page
(`/[locale]/organizer/events/[id]/fund`), the public event page
(`/[locale]/events/[id]`), registration and the judge release page
(`/[locale]/events/[id]/judge`) drive `services/core-go` for every
contract operation (issue #15, decision 1). To run them end to end you need
Go, a local Postgres, and a wallet extension.

1. **Postgres.** A local instance with this app's Prisma migrations applied:

   ```bash
   cd apps/web && npx prisma migrate deploy
   ```

   Go reads the same database directly. Give it the direct URL (port 5432,
   no `pgbouncer=true`) — see `services/core-go/README.md` "Configuration".

2. **Go, on `develop`.** From `services/core-go`, with `ESCROW_CONTRACT_ID`
   set to the same contract as `NEXT_PUBLIC_ESCROW_CONTRACT_ID` here,
   `USDC_ISSUER` set to the same issuer as this app's `USDC_ISSUER` (Go
   derives the USDC contract id from it for balance and deposit), and
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

4. **An event, from the browser (organizer path).** The organizer wallet
   needs a USDC trustline and some testnet USDC
   (<https://faucet.circle.com>, one drip per address every two hours).
   Open `/en/organizer/new` with that wallet connected: name, prizes (one
   decimal amount per rank), judge address + display name, judging
   deadline. Saving writes a `DRAFT` `Event`, its `Prize` rows and one
   `ACTIVE` `Judge` in one transaction and lands on
   `/en/organizer/events/<id>/fund`. That page reads the wallet's balance
   inside the escrow contract from Go (`GET /wallets/{address}/balance`)
   and sums the prizes itself for display:

   - **Step 1, only if the balance is short:** "Deposit <shortfall> USDC"
     asks Go to build a deposit (`POST .../deposit/build`), the wallet signs
     it, Go submits (`.../deposit/submit`). On 200 the balance is re-read
     and step 2 appears; on 202 the hash stays on screen with a "Check
     again" button that re-reads the balance — no polling.
   - **Step 2:** "Reserve <total> USDC and create the event" asks Go to
     build `create_event` (`POST /events/{id}/create/build`). Go's
     `reward` and the `escrowEventId` are shown before the sign button
     enables; if Go's reward differs from the page's own sum, signing is
     refused. The wallet signs, Go submits (`.../create/submit`) and moves
     the row `DRAFT → CREATED`; on 200 you land on the public page, which
     reads the reserved amount from the contract.

   Go's transactions carry a 60 s timebound, so each build happens when
   you press the button, never on page load.

   **Or seeded.** Create one on-chain with `services/core-go/cmd/escrow-testnet-proof`
   (or the `stellar` CLI against the contract), then seed a `LIVE` `Event`
   row whose `escrowEventId` is that event's 32-hex id, its `Prize` rows,
   and one `ACTIVE` `Judge` whose wallet you control in the browser
   extension. The public page reads the reserved amount from the contract
   (`get_event`), so the on-chain event must exist before the row does.

5. **The flow.** Go-live (`CREATED → LIVE`, #11 PR 2) is not in this app
   yet; for the rest of the flow seed or move the row to `LIVE`. Then open
   `/en/events/<id>`: connect a wallet, register (a wallet
   without a USDC trustline is refused before any row is written), connect
   the organizer wallet and close registration, then open
   `/en/events/<id>/judge` with the judge wallet, assign a team per prize,
   build, sign, and watch the hash land. Go on `develop` only logs failures
   on this path; a clean run shows nothing past the boot line, so verify
   through the hash and the `op_log` row instead.

Nothing in the browser ever holds the service token or calls Soroban RPC
for a write; the one direct RPC call is the read-only `get_event`
simulation in `src/lib/escrow/read-event.ts`.
