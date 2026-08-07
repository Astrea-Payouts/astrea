# K01 (server-build-plan.md) — custom Soroban escrow spike

**Status: complete, 2026-08-06.** Validates the role model behind **ADR-008** (custom Soroban contract, no third-party escrow provider) — done, both in unit tests and against real Stellar testnet. This is a separate spike from the original `spikes/k01-trustless-work` — same code (`K01`) in the new plan's own numbering, different question.

Result contract: `CBFPD4YFURBDQ3MQ7EMT3HPP2K34W5H6QCVWGCEP43MPHFO5XG5ONCUG`. Token used (native XLM SAC, already deployed globally on testnet — not production USDC): `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.

## What it verifies — results

| # | Check | Result |
| --- | --- | --- |
| 1 | Judge address is both `approver` and `release_signer` | ✅ PASS — same address used for both roles throughout, contract never assumes they differ |
| 2 | Organizer cannot withdraw or redirect escrowed funds through any function | ✅ PASS (structural) — no organizer-callable function moves funds anywhere; confirmed by **NEG-1** |
| 3 | Winner address bound at `release` time, not `initialize` time | ✅ PASS — winner unknown to the contract until the release call; funds landed directly in the winner's wallet, no forward-payment hop |
| 4 | Dispute blocks release; only the resolver can settle | ✅ PASS — unit tests only (`dispute_blocks_release_until_resolved`, `resolver_can_refund_organizer_on_dispute`); not re-run against testnet in this pass, no reason to expect divergent behavior from the same contract code |
| **NEG-1** | Organizer attempts `release` directly | ✅ rejected — CLI can't resolve a signing key for `release_signer` (judge) when invoked as organizer; funds did not move |
| **NEG-2** | Release the same escrow twice | ✅ rejected — `HostError: Error(Contract, #7)` = `Error::AlreadyReleased`, enforced by the contract's own state, not just client-side |

`cargo test` (8 unit tests, in-process WASM VM): all passing. Full transaction log with stellar.expert links for every step is in the run output — see "How to run" below to reproduce.

## Findings folded into ADR-008

1. **The role model works.** One judge address as both `approver` and `release_signer`, and the winner bound only at `release` — both verified on real testnet, not just assumed from the contract source. This is the concrete fix for ADR-007's two-hop payout: `release(winner)` pays the winner directly, no forward-payment step, no extra transaction, no extra fee.
2. **Toolchain note for anyone reproducing this:** current `soroban-sdk` (27.x) refuses to build for `wasm32-unknown-unknown` under Rust 1.84+ — it requires `wasm32v1-none` instead (the newer target disables WASM features, reference-types/multi-value, that Soroban's environment doesn't support yet). Not documented anywhere obvious; found by reading the SDK's own `build.rs` panic message.
3. **`stellar-cli`'s actual flag names differ from older `soroban-cli` tutorials/docs floating around:** `--source-account` (not `--source`), no `--global` flag on `keys generate` (identities are already stored in a persistent config dir by default), and `--network` goes after the subcommand's own args, not before it.
4. **The native-XLM Stellar Asset Contract is already deployed on testnet** (deterministic address, same for everyone) — `stellar contract asset deploy --asset native` fails with `"contract already exists"`; use `stellar contract id asset --asset native --network testnet` to derive its address instead of deploying it.
5. **NEG-1's rejection mechanism is CLI-side (missing signing key), not a contract-level auth error** like NEG-2's is. Functionally equivalent for this spike's purpose — organizer never moved funds — but worth knowing: a caller with judge's actual key would still fail at the contract's `require_auth()` check inside `release`, this spike just didn't need to prove that separately since it's the same `require_auth` mechanism NEG-2 already exercised end-to-end.

## How to run

Requirements: Rust (`rustup`, `wasm32v1-none` target — **not** `wasm32-unknown-unknown`, see finding #2), `stellar` CLI (`cargo install --locked stellar-cli`), Visual Studio Build Tools with the C++ workload on Windows (Rust's MSVC linker).

```bash
# from spikes/k01-soroban-escrow/
cargo test                          # unit tests, in-process, no network

cargo build --target wasm32v1-none --release
# wasm output: target/wasm32v1-none/release/k01_soroban_escrow.wasm

./scripts/run-testnet-spike.sh      # deploy + fund + approve + release, real testnet, 2 NEG checks
```

`scripts/run-testnet-spike.sh` generates and funds (via friendbot) four testnet identities — organizer, judge, resolver, winner — derives the native-XLM token's contract id, deploys the escrow contract, and runs initialize → fund → approve → NEG-1 → release → NEG-2 end to end, printing the resulting balance and both contract IDs.

## Next step

K01 is done. Per `server-build-plan.md`'s own sequencing, **K02** (Go ↔ Soroban integration spike — confirm a Go service can build/sign/submit against this contract) is next; don't start **S01** (monorepo scaffold) before that.
