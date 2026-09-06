import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	type CampaignSlate,
	calculateTotalSEquivalents,
	formatGrantFoxIssuePayload,
	SEPTEMBER_15_CAMPAIGN_SLATE,
	validateCampaignSlate,
} from "./slate";

const REPO_ROOT = resolve(process.cwd(), "../..");

describe("GrantFox Campaign Slate", () => {
	it("calculates S-equivalents accurately (S=1, M=3, L=5)", () => {
		const total = calculateTotalSEquivalents(SEPTEMBER_15_CAMPAIGN_SLATE.items);
		expect(total).toBe(11);
	});

	it("validates the official September 15 campaign slate against all rules", () => {
		const result = validateCampaignSlate(
			SEPTEMBER_15_CAMPAIGN_SLATE,
			REPO_ROOT,
		);
		expect(result.isValid).toBe(true);
		expect(result.violations).toHaveLength(0);
		expect(result.totalIssues).toBe(7);
		expect(result.totalSEquivalents).toBe(11);
		expect(result.categories.length).toBeGreaterThanOrEqual(3);
	});

	it("enforces Rule 1: rejects any slate containing size L items", () => {
		const modifiedSlate: CampaignSlate = {
			...SEPTEMBER_15_CAMPAIGN_SLATE,
			items: [
				...SEPTEMBER_15_CAMPAIGN_SLATE.items.slice(0, 5),
				{
					number: 52,
					code: "U01",
					title: "Event creation wizard",
					phase: "phase: product-ui",
					size: "L",
					sEquivalents: 5,
					category: "extension-wallet",
					prerequisites: ["wizard stepper"],
					filesVerified: ["docs/architecture.md"],
					status: "ready",
				},
			],
		};

		const result = validateCampaignSlate(modifiedSlate, REPO_ROOT);
		expect(result.isValid).toBe(false);
		expect(
			result.violations.some((v) => v.rule.includes("Rule 1: No size: L")),
		).toBe(true);
	});

	it("enforces Rule 2 & 3: fails when a prerequisite file does not exist in the repository", () => {
		const modifiedSlate: CampaignSlate = {
			...SEPTEMBER_15_CAMPAIGN_SLATE,
			items: [
				...SEPTEMBER_15_CAMPAIGN_SLATE.items.slice(0, 6),
				{
					number: 999,
					code: "X99",
					title: "Non-existent component dependency",
					phase: "phase: spike",
					size: "S",
					sEquivalents: 1,
					category: "hardware-wallet",
					prerequisites: ["Fake dependency unbuilt"],
					filesVerified: ["non/existent/path/to/file.ts"],
					status: "ready",
				},
			],
		};

		const result = validateCampaignSlate(modifiedSlate, REPO_ROOT);
		expect(result.isValid).toBe(false);
		expect(
			result.violations.some((v) =>
				v.rule.includes("Rule 2: No unbuilt dependencies"),
			),
		).toBe(true);
	});

	it("enforces Rule 4: requires varied functional categories (at least 3)", () => {
		const monotoneSlate: CampaignSlate = {
			...SEPTEMBER_15_CAMPAIGN_SLATE,
			items: SEPTEMBER_15_CAMPAIGN_SLATE.items.map((item) => ({
				...item,
				category: "extension-wallet",
			})),
		};

		const result = validateCampaignSlate(monotoneSlate, REPO_ROOT);
		expect(result.isValid).toBe(false);
		expect(
			result.violations.some((v) => v.rule.includes("Rule 4: Varied slate")),
		).toBe(true);
	});

	it("enforces capacity budgeting between 10 and 14 S-equivalents", () => {
		const underCapacitySlate: CampaignSlate = {
			...SEPTEMBER_15_CAMPAIGN_SLATE,
			items: SEPTEMBER_15_CAMPAIGN_SLATE.items.slice(0, 6).map((item) => ({
				...item,
				size: "S",
				sEquivalents: 1,
			})),
		};

		const result = validateCampaignSlate(underCapacitySlate, REPO_ROOT);
		expect(result.isValid).toBe(false);
		expect(
			result.violations.some((v) => v.rule.includes("Capacity: S-Equivalents")),
		).toBe(true);
	});

	it("formats prepared issue payload with GrantFox stipulations and DoD checklist", () => {
		const payload = formatGrantFoxIssuePayload(
			SEPTEMBER_15_CAMPAIGN_SLATE.items[0],
		);
		expect(payload).toContain("### [GrantFox Campaign: 2026-09-15] K03");
		expect(payload).toContain("Verified Prerequisites");
		expect(payload).toContain(
			"GrantFox Contributor Stipulations & DoD Requirements",
		);
		expect(payload).toContain(
			"Payout routing block included in PR description",
		);
	});
});
