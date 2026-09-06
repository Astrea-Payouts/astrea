import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type IssueSize = "S" | "M" | "L";

export type SlateCategory =
	| "security-doc"
	| "i18n"
	| "hardware-wallet"
	| "mobile-protocol"
	| "extension-wallet";

export interface SlateItem {
	number: number;
	code: string;
	title: string;
	phase: string;
	size: IssueSize;
	sEquivalents: number;
	category: SlateCategory;
	prerequisites: string[];
	filesVerified: string[];
	status: "ready" | "in-progress" | "blocked";
}

export interface CampaignSlate {
	campaignName: string;
	campaignDate: string;
	publishDate: string;
	maxConcurrentPRs: number;
	inactivityWarningDays: number;
	inactivityUnassignDays: number;
	items: SlateItem[];
}

export interface ValidationViolation {
	rule: string;
	message: string;
	itemNumber?: number;
}

export interface ValidationResult {
	isValid: boolean;
	totalSEquivalents: number;
	totalIssues: number;
	violations: ValidationViolation[];
	categories: SlateCategory[];
}

/**
 * Calculates total S-equivalents for a set of slate items.
 * Rule: size S = 1 S-eq, size M = 3 S-eq, size L = 5 S-eq.
 */
export function calculateTotalSEquivalents(items: SlateItem[]): number {
	return items.reduce((acc, item) => {
		if (item.size === "S") return acc + 1;
		if (item.size === "M") return acc + 3;
		if (item.size === "L") return acc + 5;
		return acc;
	}, 0);
}

/**
 * Validates a campaign slate against all 5 campaign slate rules and capacity constraints.
 *
 * Rules enforced:
 * 1. No size: L on a slate (must be split prior to publishing).
 * 2. No issue whose dependency is unbuilt.
 * 3. Every slate item names its prerequisites and states they are met in code.
 * 4. Keep the slate varied (at least 3 distinct functional categories).
 * 5. Inactivity policy (5 days warning, 8 days unassigned).
 * Capacity: 10-14 S-equivalents (6-8 issues). Cap concurrent PRs at 4.
 */
export function validateCampaignSlate(
	slate: CampaignSlate,
	repoRoot: string,
): ValidationResult {
	const violations: ValidationViolation[] = [];
	const categories = Array.from(new Set(slate.items.map((i) => i.category)));

	// Rule 1: No size: L
	for (const item of slate.items) {
		if (item.size === "L") {
			violations.push({
				rule: "Rule 1: No size: L",
				message: `Issue #${item.number} (${item.code}) is size L. Large issues must be split before publishing.`,
				itemNumber: item.number,
			});
		}
	}

	// Rule 2 & 3: Prerequisites stated, verified, and files physically exist
	for (const item of slate.items) {
		if (item.prerequisites.length === 0) {
			violations.push({
				rule: "Rule 3: Prerequisites stated",
				message: `Issue #${item.number} does not state any prerequisites.`,
				itemNumber: item.number,
			});
		}
		if (item.filesVerified.length === 0) {
			violations.push({
				rule: "Rule 3: Prerequisites verified in code",
				message: `Issue #${item.number} has no verified codebase files attached.`,
				itemNumber: item.number,
			});
		}

		for (const relPath of item.filesVerified) {
			const absPath = resolve(repoRoot, relPath);
			if (!existsSync(absPath)) {
				violations.push({
					rule: "Rule 2: No unbuilt dependencies",
					message: `Issue #${item.number} verified file does not exist: ${relPath}`,
					itemNumber: item.number,
				});
			}
		}
	}

	// Rule 4: Keep slate varied
	if (categories.length < 3) {
		violations.push({
			rule: "Rule 4: Varied slate",
			message: `Slate contains only ${categories.length} categories (${categories.join(", ")}). Must contain at least 3 distinct categories.`,
		});
	}

	// Capacity checks
	const totalSEquivalents = calculateTotalSEquivalents(slate.items);
	const totalIssues = slate.items.length;

	if (totalIssues < 6 || totalIssues > 8) {
		violations.push({
			rule: "Capacity: Issue Count",
			message: `Slate issue count ${totalIssues} is outside the required 6-8 range.`,
		});
	}

	if (totalSEquivalents < 10 || totalSEquivalents > 14) {
		violations.push({
			rule: "Capacity: S-Equivalents",
			message: `Total S-equivalents (${totalSEquivalents}) is outside the 10-14 S-equivalent budget.`,
		});
	}

	if (slate.maxConcurrentPRs > 4) {
		violations.push({
			rule: "Capacity: Concurrent PRs",
			message: `Concurrent PR cap (${slate.maxConcurrentPRs}) exceeds maximum of 4.`,
		});
	}

	if (slate.inactivityWarningDays !== 5 || slate.inactivityUnassignDays !== 8) {
		violations.push({
			rule: "Rule 5: Inactivity Policy",
			message: `Inactivity policy must be 5 days warning and 8 days unassignment (configured: ${slate.inactivityWarningDays}d / ${slate.inactivityUnassignDays}d).`,
		});
	}

	return {
		isValid: violations.length === 0,
		totalSEquivalents,
		totalIssues,
		violations,
		categories,
	};
}

/**
 * The official September 15, 2026 GrantFox campaign slate definition.
 */
export const SEPTEMBER_15_CAMPAIGN_SLATE: CampaignSlate = {
	campaignName: "Astrea September 15 GrantFox Campaign",
	campaignDate: "2026-09-15",
	publishDate: "2026-09-13",
	maxConcurrentPRs: 4,
	inactivityWarningDays: 5,
	inactivityUnassignDays: 8,
	items: [
		{
			number: 18,
			code: "K03",
			title: "Wallet compat: test xBull and LOBSTR",
			phase: "phase: spike",
			size: "S",
			sEquivalents: 1,
			category: "extension-wallet",
			prerequisites: [
				"ADR-005 (wallet connection UX session) landed in docs/architecture.md",
				"@creit.tech/stellar-wallets-kit integrated in apps/web",
			],
			filesVerified: [
				"docs/architecture.md",
				"apps/web/package.json",
				"apps/web/src/lib/wallet/kit.ts",
			],
			status: "ready",
		},
		{
			number: 40,
			code: "K05d",
			title: "Wallet compat: Ledger and Trezor (hardware wallets)",
			phase: "phase: spike",
			size: "S",
			sEquivalents: 1,
			category: "hardware-wallet",
			prerequisites: [
				"ADR-005 landed",
				"K03 harness in spikes/k03-wallet-compat available for WebUSB/WebHID extension",
			],
			filesVerified: [
				"docs/architecture.md",
				"spikes/k03-wallet-compat/README.md",
				"spikes/k03-wallet-compat/web/main.ts",
			],
			status: "ready",
		},
		{
			number: 41,
			code: "K05e",
			title: "WalletConnect protocol integration",
			phase: "phase: spike",
			size: "M",
			sEquivalents: 3,
			category: "mobile-protocol",
			prerequisites: [
				"ADR-005 landed",
				"K03 harness available in spikes/k03-wallet-compat",
			],
			filesVerified: [
				"docs/architecture.md",
				"spikes/k03-wallet-compat/README.md",
				"spikes/k03-wallet-compat/web/main.ts",
			],
			status: "ready",
		},
		{
			number: 44,
			code: "U16",
			title: "Spanish translation & i18n QA pass",
			phase: "phase: product-ui",
			size: "S",
			sEquivalents: 1,
			category: "i18n",
			prerequisites: [
				"next-intl routing in apps/web/src/i18n/routing.ts",
				"es.json and en.json message catalogs present",
			],
			filesVerified: [
				"apps/web/src/i18n/routing.ts",
				"apps/web/messages/en.json",
				"apps/web/messages/es.json",
			],
			status: "ready",
		},
		{
			number: 107,
			code: "L01a",
			title: "Write the threat model for the escrow contract",
			phase: "phase: launch",
			size: "M",
			sEquivalents: 3,
			category: "security-doc",
			prerequisites: [
				"Escrow contract implementation in smart-contracts/astrea/contracts/event-escrow",
				"ADR-001, ADR-002, ADR-003, ADR-006 recorded in docs/architecture.md",
			],
			filesVerified: [
				"smart-contracts/astrea/contracts/event-escrow/src/lib.rs",
				"smart-contracts/astrea/contracts/event-escrow/src/test.rs",
				"docs/architecture.md",
				"docs/contracts-build-plan.md",
			],
			status: "ready",
		},
		{
			number: 37,
			code: "K05a",
			title: "Wallet compat: Rabet, Hana, Klever",
			phase: "phase: spike",
			size: "S",
			sEquivalents: 1,
			category: "extension-wallet",
			prerequisites: ["K03 test harness available in spikes/k03-wallet-compat"],
			filesVerified: [
				"spikes/k03-wallet-compat/README.md",
				"spikes/k03-wallet-compat/web/main.ts",
			],
			status: "ready",
		},
		{
			number: 38,
			code: "K05b",
			title: "Wallet compat: D'CENT, OneKey, HotWallet",
			phase: "phase: spike",
			size: "S",
			sEquivalents: 1,
			category: "hardware-wallet",
			prerequisites: ["K03 test harness available in spikes/k03-wallet-compat"],
			filesVerified: [
				"spikes/k03-wallet-compat/README.md",
				"spikes/k03-wallet-compat/web/main.ts",
			],
			status: "ready",
		},
	],
};

/**
 * Formats a GrantFox prepared issue template.
 */
export function formatGrantFoxIssuePayload(item: SlateItem): string {
	return `### [GrantFox Campaign: 2026-09-15] ${item.code} — ${item.title}

| Field | Value |
|---|---|
| **Issue Number** | #${item.number} |
| **Code** | ${item.code} |
| **Size** | ${item.size} (${item.sEquivalents} S-equivalent${item.sEquivalents > 1 ? "s" : ""}) |
| **Phase** | ${item.phase} |
| **Category** | ${item.category} |
| **Status** | ${item.status.toUpperCase()} |

#### Verified Prerequisites
${item.prerequisites.map((p) => `- [x] ${p}`).join("\n")}

#### Verified Codebase Files
${item.filesVerified.map((f) => `- \`${f}\``).join("\n")}

#### GrantFox Contributor Stipulations & DoD Requirements
- [ ] PR targets \`develop\` branch and references \`Closes #${item.number}\`
- [ ] All CI checks passing (lint, typecheck, test, build, graphify in sync)
- [ ] Conventional Commits formatting on all commits
- [ ] Definition of Done checklist verified against docs/definition-of-done.md
- [ ] Payout routing block included in PR description (EVM address + Stellar public key)
- [ ] Inactivity policy acknowledged (5d inquiry, 8d unassignment)
`;
}
