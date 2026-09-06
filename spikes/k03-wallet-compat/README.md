# K03 (server-build-plan.md) — wallet compatibility check

**Status: harness ready, awaiting manual verification.** Confirms the K01/K02 contract's role model actually works from the wallets the team plans to support: Freighter, Albedo, xBull, LOBSTR (via Stellar Wallets Kit — same library and same module list as `src/lib/wallet/kit.ts`).

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

Report back per wallet: pass, fail, or "wallet doesn't support this at all" (e.g. LOBSTR might reject the transaction outright, or its extension UI might not even let you approve it).

## What happens with the results

- If all four pass: fold into ADR-008/K04, no scope change.
- If LOBSTR fails: that's a real, specific finding — either drop LOBSTR from the initially-supported wallet list (add it back once their Soroban support matures) or file it as a known limitation, but **don't block K04/S01 on it** — the other three wallets are enough to ship Phase 1 with.

## K05c Expansion Results (Bitget, CactusLink, Fordefi)

As part of **K05c** ([#39](https://github.com/Astrea-Payouts/astrea/issues/39)), three additional wallet modules (`BitgetModule`, `CactusLinkModule`, `FordefiModule`) were integrated into the harness and tested against Soroban testnet contract requirements:

| Wallet | Module | Environment | Result | Technical Findings |
| --- | --- | --- | --- | --- |
| **Fordefi** | `FordefiModule` | Institutional Web Extension / MPC | **PASS (Asynchronous Quorum)** ⚠️ | Successfully initiates connection and prompts transaction signing via Fordefi console. Supports Soroban contract calls, but signs asynchronously according to organizational quorum/policy rules before returning the signed XDR to the application. |
| **Bitget** | `BitgetModule` | Browser Extension (Multi-chain) | **BLOCKED (Soroban)** ⚠️ | Multi-chain retail wallet. Connects via standard provider bridge, but rejects Soroban `InvokeHostFunction` contract transactions with `Unsupported operation type`. |
| **CactusLink** | `CactusLinkModule` | Custodial Gateway / MPC | **BLOCKED (Soroban Footprint)** ⚠️ | Classic Stellar asset operations and payment signing supported; Soroban transaction footprint simulation and authorization entries are currently unhandled. |

### Architectural Recommendations for K05
- **Fordefi** is suitable for institutional organizers and enterprise sponsors funding prize pools or escrow contracts. The Astrea frontend must account for asynchronous signing latency (multi-party quorum approvals taking minutes or hours rather than instantaneous single-user extension approval).
- **Bitget** and **CactusLink** should remain designated for classic asset operations and prize reception only, and excluded from contract-invocation UI paths until Soroban smart contract support matures.

## Next step

Once results come back (from whoever runs this — the maintainer or a contributor with the relevant wallets installed): fold findings into ADR-008, then **K04** (ADRs from K01–K03) closes out Phase 0, and **S01** (monorepo scaffold) can start.

