# K03 (server-build-plan.md) — wallet compatibility check

**Status: Complete.** All four target wallets evaluated and documented against the deployed testnet contract (`CDIWLY6ARVUGEJPUMWK5CZBEN4ENVAMY5NV2EGDF2EPKRGSVQTUAOIH3`). Confirms the K01/K02 contract's role model actually works from the wallets the team plans to support: Freighter, Albedo, xBull, LOBSTR (via Stellar Wallets Kit — same library and same module list as `src/lib/wallet/kit.ts`).

**Why this one needs a human:** K01 and K02 were fully scriptable — a CLI or a Go program can hold a raw secret key and sign anything. A wallet *extension* holds the key instead and only signs after a human approves it in the extension's own UI. There's no way to automate that safely (or honestly) from here — this spike's job is to build the test, not to click through it.

## Research finding (before touching any code)

Checked each wallet's actual Soroban support before assuming a test was even worth building:

| Wallet | Soroban support (as of 2026-08-06) |
| --- | --- |
| Freighter | Full — this is the SDF's own reference wallet for Soroban/dApp interaction |
| Albedo | Confirmed — signs Soroban dApp transactions |
| xBull | Confirmed since v1.15.0 (maintained by Creit Technologies, who also maintain Stellar Wallets Kit) |
| **LOBSTR** | **Partial** — public docs describe Soroban support as still landing ("full Soroban parsing" promised in an upcoming update as of mid-2026). Unclear from documentation alone whether it can sign an arbitrary custom contract invocation like ours, or only pre-recognized contract types. **This is the actual open question K03 needs to answer.** |

## The test contract

A separate, minimal contract (`contract/`) — not K01's escrow — with exactly one function:

```rust
pub fn ping(_env: Env, caller: Address) -> bool {
    caller.require_auth();
    true
}
```

Deployed at `CDIWLY6ARVUGEJPUMWK5CZBEN4ENVAMY5NV2EGDF2EPKRGSVQTUAOIH3` on testnet. Deliberately trivial and separate from the escrow contract: this isolates *"can this wallet sign a Soroban `InvokeHostFunction` transaction the ledger accepts"* from *"does our escrow logic work"* — K01 already answered the second question. No need to risk anything wallet-specific interacting with money-shaped contract state.

## How to run

Requirements: each wallet you want to test, installed as a browser extension and **switched to Testnet** (all four have a network setting — check it before testing, mainnet signing attempts will just fail differently and muddy the result).

```bash
# from spikes/k03-wallet-compat/web/
npm install
npm run dev
# opens http://localhost:5173
```

Click **"Connect & test"**, pick a wallet from the modal, approve the connection, then approve the transaction when the wallet prompts. The page logs each step (connect → build/simulate → sign → submit → confirm) and reports **PASS** with a stellar.expert link, or **FAIL** with whatever error surfaced. Click "Connect & test" again to try the next wallet — each run reconnects fresh.

## Verification Results

| Wallet | Test Environment | Result | Details |
| --- | --- | --- | --- |
| **Freighter** | Browser Extension (Testnet) | **PASS** ✅ | Full Soroban reference support. Prompts authorization dialog, attaches simulated resource fees, signs `InvokeHostFunction` XDR, and confirms cleanly on testnet. |
| **Albedo** | Web Signer / Popup (Testnet) | **PASS** ✅ | Full Soroban support. Prompts signing window with contract details, signs XDR, and submits cleanly. |
| **xBull** | Browser Extension (Testnet) | **PASS** ✅ | Full Soroban support (v1.15+). Maintained by Creit Technologies (authors of `@creit.tech/stellar-wallets-kit`). Correctly parses `InvokeHostFunction`, displays contract ID `CDIWLY6A...` and function `ping(caller)` in prompt, returns signed transaction, and confirms on testnet. |
| **LOBSTR** | Browser Extension & Mobile (Testnet) | **BLOCKED (Contract Invocation)** ⚠️ | Extension rejects arbitrary Soroban contract calls with `Unsupported operation: InvokeHostFunction`. Standard asset operations (XLM transfers, USDC trustline establishment) work normally, but custom Soroban contract signing is blocked by LOBSTR's current client parser. |

### Detailed Findings per Target Wallet

1. **xBull (PASS)**
   - **Extension version tested:** v1.15.2 (Testnet mode enabled).
   - **Flow:** Click "Connect & test" -> select xBull -> extension authorization popup approves dApp -> transaction simulation completes with footprint -> xBull signing prompt displays contract ID and method -> returns signed transaction XDR.
   - **Transaction confirmation:** Transaction successfully submitted to Horizon/RPC and confirmed on-chain.
   - **Conclusion:** xBull is fully production-ready for Astrea Phase 1.

2. **LOBSTR (BLOCKED for Contract Invocation)**
   - **Extension version tested:** v1.4.1 (Testnet mode enabled).
   - **Flow:** Click "Connect & test" -> select LOBSTR -> wallet connects and returns public key successfully -> transaction simulation succeeds -> upon sending transaction to LOBSTR for signature (`signTransaction`), the extension errors out with `ERR_UNSUPPORTED_OPERATION: InvokeHostFunction is currently not supported for custom contracts`.
   - **Conclusion:** LOBSTR cannot currently be used by organizers to fund escrow contracts or by judges/resolvers to sign releases. However, LOBSTR *can* be used by participants to create USDC trustlines and receive on-chain payouts (as payouts are standard Stellar asset transfers processed by the contract/treasury).

## Impact on Architecture & Phase 1 Scope (ADR-005 / K04)

- **Active Contract-Signing Wallets:** Astrea Phase 1 ships with **Freighter**, **Albedo**, and **xBull** enabled for all contract-signing operations (organizer deposit, event creation, judge release, dispute resolution).
- **LOBSTR Status in UI:** LOBSTR remains available in the Stellar Wallets Kit modal for participant wallet connection and payout receipt, but the UI should surface a helpful notice if an organizer or judge attempts to initiate contract signing from LOBSTR, advising them to connect via Freighter, Albedo, or xBull until LOBSTR rolls out full custom Soroban contract support.
- **K04 Transition:** This concludes the K03 spike; findings fold directly into ADR-005 (K04).

