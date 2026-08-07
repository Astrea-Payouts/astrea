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

## Next step

Once results come back (from whoever runs this — the maintainer or a contributor with the relevant wallets installed): fold findings into ADR-008, then **K04** (ADRs from K01–K03) closes out Phase 0, and **S01** (monorepo scaffold) can start.
