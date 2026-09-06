# GrantFox Campaign Slate — September 15, 2026

| Metadata | Specification |
|---|---|
| **Campaign Name** | Astrea September 15 GrantFox Campaign |
| **Campaign Window** | 2026-09-15 → 2026-09-30 (Increment 2) |
| **Publication Date** | 2026-09-13 (Prepared prior to campaign launch) |
| **Total Issues** | 7 issues (constraint: 6–8 issues) |
| **Total S-Equivalents** | 11 S-equivalents (budget: 10–14 S-equivalents) |
| **Review Concurrency Cap** | Maximum 4 concurrent contributor Pull Requests |
| **Inactivity Policy** | 5 days silent → status comment; 8 days silent → unassigned & returned to pool |

---

## 1. Compliance with Campaign Slate Rules

All items on this slate adhere strictly to the 5 Campaign Slate Rules established in [docs/sprint-plan.md](sprint-plan.md):

1. **No `size: L` on the slate**: Every issue on this slate is sized `S` (1 S-equivalent) or `M` (3 S-equivalents). Zero `L` issues are admitted.
2. **No unbuilt dependencies**: All issues selected have their technical and code prerequisites physically present and verified in the repository.
3. **Prerequisites explicitly stated and verified in code**: Each item below states its prerequisites and links directly to existing codebase files, test harnesses, and architecture decision records.
4. **Slate variety**: The slate is intentionally balanced across four distinct functional categories:
   - Security architecture & threat modeling (`security-doc`)
   - Product UI localization & internationalization (`i18n`)
   - Advanced wallet connection protocols (`mobile-protocol`)
   - Hardware and browser extension wallet compatibility spikes (`hardware-wallet`, `extension-wallet`)
5. **Enforced inactivity policy**: The 5-day check-in / 8-day unassignment rule is stated in every issue's criteria.

---

## 2. Slate Summary Table

| # | Code | Title | Phase | Size | S-eq | Category | Prerequisites Status |
|---|---|---|---|---|---|---|---|
| [#18](https://github.com/Astrea-Payouts/astrea/issues/18) | K03 | Wallet compat: test xBull and LOBSTR | Phase 0 — spike | S | 1 | `extension-wallet` | Verified in tree (`apps/web/src/lib/wallet/kit.ts`, ADR-005) |
| [#40](https://github.com/Astrea-Payouts/astrea/issues/40) | K05d | Wallet compat: Ledger and Trezor (hardware wallets) | Phase 0 — spike | S | 1 | `hardware-wallet` | Verified in tree (`spikes/k03-wallet-compat/web/main.ts`) |
| [#41](https://github.com/Astrea-Payouts/astrea/issues/41) | K05e | WalletConnect protocol integration | Phase 0 — spike | M | 3 | `mobile-protocol` | Verified in tree (`spikes/k03-wallet-compat/web/main.ts`) |
| [#44](https://github.com/Astrea-Payouts/astrea/issues/44) | U16 | Spanish translation & i18n QA pass | Phase 2 — product UI | S | 1 | `i18n` | Verified in tree (`apps/web/messages/es.json`, `en.json`) |
| [#107](https://github.com/Astrea-Payouts/astrea/issues/107) | L01a | Threat model for the escrow contract | Phase 5 — launch | M | 3 | `security-doc` | Verified in tree (`smart-contracts/astrea/contracts/event-escrow`) |
| [#37](https://github.com/Astrea-Payouts/astrea/issues/37) | K05a | Wallet compat: Rabet, Hana, Klever | Phase 0 — spike | S | 1 | `extension-wallet` | Verified in tree (`spikes/k03-wallet-compat/web/main.ts`) |
| [#38](https://github.com/Astrea-Payouts/astrea/issues/38) | K05b | Wallet compat: D'CENT, OneKey, HotWallet | Phase 0 — spike | S | 1 | `hardware-wallet` | Verified in tree (`spikes/k03-wallet-compat/web/main.ts`) |

**Total Capacity: 7 issues | 11 S-equivalents (5 × S + 2 × M)**

---

## 3. Detailed Item Profiles & Code Verification

### 3.1 #18 [K03] Wallet compat: test xBull and LOBSTR
- **Issue**: https://github.com/Astrea-Payouts/astrea/issues/18
- **Size**: S (1 S-equivalent)
- **Assigned**: Unassigned
- **Objective**: Test xBull and LOBSTR wallet modules via `@creit.tech/stellar-wallets-kit`, verify connection and Soroban transaction signing on Stellar testnet.
- **Physical Verification**:
  - `docs/architecture.md`: ADR-005 (Wallet connection UX session) is merged.
  - `apps/web/package.json`: `@creit.tech/stellar-wallets-kit` dependency present.
  - `apps/web/src/lib/wallet/kit.ts`: LobstrModule and xBullModule imports configured.

### 3.2 #40 [K05d] Wallet compat: Ledger and Trezor (hardware wallets)
- **Issue**: https://github.com/Astrea-Payouts/astrea/issues/40
- **Size**: S (1 S-equivalent)
- **Assigned**: Unassigned
- **Objective**: Extend the wallet compatibility spike to verify WebUSB/WebHID connection and signing with hardware devices (Ledger, Trezor).
- **Physical Verification**:
  - `spikes/k03-wallet-compat/README.md`: Harness documentation and results table in place.
  - `spikes/k03-wallet-compat/web/main.ts`: Modular harness ready for hardware module addition.

### 3.3 #41 [K05e] WalletConnect protocol integration
- **Issue**: https://github.com/Astrea-Payouts/astrea/issues/41
- **Size**: M (3 S-equivalents)
- **Assigned**: Unassigned
- **Objective**: Implement WalletConnect v2 protocol adapter within the Stellar Wallets Kit spike for mobile QR code signing flows.
- **Physical Verification**:
  - `spikes/k03-wallet-compat/web/main.ts`: Wallet connection interface and transaction submission pipeline implemented.
  - `docs/architecture.md`: ADR-005 session handling specification present.

### 3.4 #44 [U16] Spanish translation & i18n QA pass
- **Issue**: https://github.com/Astrea-Payouts/astrea/issues/44
- **Size**: S (1 S-equivalent)
- **Assigned**: Unassigned
- **Objective**: Translate raw English copy and placeholder strings in `apps/web/messages/es.json`, ensuring complete parity with `en.json` across event creation, payout status, and wallet connection modals.
- **Physical Verification**:
  - `apps/web/src/i18n/routing.ts`: `next-intl` configuration supports `es` and `en` locales.
  - `apps/web/messages/en.json` & `apps/web/messages/es.json`: Translation dictionaries exist and are referenced in app routes.

### 3.5 #107 [L01a] Write the threat model for the escrow contract
- **Issue**: https://github.com/Astrea-Payouts/astrea/issues/107
- **Size**: M (3 S-equivalents)
- **Assigned**: Unassigned
- **Objective**: Author comprehensive STRIDE threat model documentation for the `event-escrow` contract covering double-release, unauthorized initialization, dispute manipulation, and fee draining vectors.
- **Physical Verification**:
  - `smart-contracts/astrea/contracts/event-escrow/src/lib.rs`: Escrow contract logic implemented.
  - `smart-contracts/astrea/contracts/event-escrow/src/test.rs`: 78 unit test assertions verifying authorization and error states.
  - `docs/architecture.md`: ADR-001, ADR-002, ADR-003, ADR-006 state contracts architecture.

### 3.6 #37 [K05a] Wallet compat: Rabet, Hana, Klever
- **Issue**: https://github.com/Astrea-Payouts/astrea/issues/37
- **Size**: S (1 S-equivalent)
- **Assigned**: Unassigned
- **Objective**: Add Rabet, Hana, and Klever kit modules to the test harness, test Soroban contract call signing on testnet, record results.
- **Physical Verification**:
  - `spikes/k03-wallet-compat/web/main.ts`: Harness supports pluggable kit modules.
  - `spikes/k03-wallet-compat/README.md`: Results matrix ready for addition.

### 3.7 #38 [K05b] Wallet compat: D'CENT, OneKey, HotWallet
- **Issue**: https://github.com/Astrea-Payouts/astrea/issues/38
- **Size**: S (1 S-equivalent)
- **Assigned**: Unassigned
- **Objective**: Add D'CENT, OneKey, and HotWallet kit modules to test harness, verify connection models (companion app vs extension bridge), record results.
- **Physical Verification**:
  - `spikes/k03-wallet-compat/web/main.ts`: Harness available.
  - `spikes/k03-wallet-compat/README.md`: Results matrix ready for addition.

---

## 4. GrantFox Campaign Payout Requirements

All contributors claiming issues on this campaign slate must satisfy the official criteria defined in [docs/definition-of-done.md](definition-of-done.md):

1. **Pull Request Target**: All PRs must target the upstream `develop` branch and declare `Closes #<issue_number>`.
2. **Definition of Done Verification**:
   - Automated CI checks pass (lint, typecheck, unit tests, build).
   - Commit messages conform to Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
   - UI changes include both desktop (1280px+) and mobile (375px) screenshots.
   - Money-path changes include testnet transaction hash and `security` label.
3. **Mandatory Payout Routing**: Contributors must include a verified payout address block in the PR description:
   ```markdown
   ## Payout Routing
   - **EVM (Base/Arbitrum/Polygon/ETH):** `<0x_address>`
   - **Stellar:** `<G_public_key>`
   ```
4. **Settlement Mechanism**: Payout release occurs automatically via GrantFox escrow upon maintainer approval and squash-merge into `develop`.
