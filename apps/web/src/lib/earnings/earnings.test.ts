import { describe, expect, it } from "vitest";
import { getSampleEarnings } from "./query";
import {
	calculateEarningsSummary,
	filterAndSortEarnings,
	formatPayoutDate,
} from "./summary";

describe("calculateEarningsSummary", () => {
	it("aggregates total amount, prize count, event count, and average cleanly", () => {
		const items = getSampleEarnings("GBXYZ...WINNERWALLET");
		const summary = calculateEarningsSummary(items);

		expect(summary.totalUsdcNum).toBe(12000);
		expect(summary.totalUsdc).toBe("12,000");
		expect(summary.totalPrizesCount).toBe(4);
		expect(summary.totalEventsCount).toBe(4);
		expect(summary.averageUsdc).toBe("3,000");
		expect(summary.latestPayoutDate).toBe("2026-08-28T14:32:00Z");
	});

	it("returns safe zero metrics for empty earnings history", () => {
		const summary = calculateEarningsSummary([]);

		expect(summary.totalUsdcNum).toBe(0);
		expect(summary.totalUsdc).toBe("0");
		expect(summary.totalPrizesCount).toBe(0);
		expect(summary.totalEventsCount).toBe(0);
		expect(summary.averageUsdc).toBe("0");
		expect(summary.latestPayoutDate).toBeNull();
	});
});

describe("filterAndSortEarnings", () => {
	const items = getSampleEarnings("GBXYZ...TEST");

	it("filters by event name query case-insensitively", () => {
		const filtered = filterAndSortEarnings(items, {
			searchQuery: "soroban",
			sortBy: "date-desc",
		});

		expect(filtered.length).toBe(1);
		expect(filtered[0].eventName).toContain("Soroban");
	});

	it("filters by transaction hash substring", () => {
		const filtered = filterAndSortEarnings(items, {
			searchQuery: "8f7e",
			sortBy: "date-desc",
		});

		expect(filtered.length).toBe(1);
		expect(filtered[0].id).toBe("pay_scf_infrastructure_bounty");
	});

	it("sorts by amount descending", () => {
		const sorted = filterAndSortEarnings(items, {
			searchQuery: "",
			sortBy: "amount-desc",
		});

		expect(sorted[0].amountUsdcNum).toBe(5000);
		expect(sorted[sorted.length - 1].amountUsdcNum).toBe(1500);
	});

	it("sorts by amount ascending", () => {
		const sorted = filterAndSortEarnings(items, {
			searchQuery: "",
			sortBy: "amount-asc",
		});

		expect(sorted[0].amountUsdcNum).toBe(1500);
		expect(sorted[sorted.length - 1].amountUsdcNum).toBe(5000);
	});

	it("sorts by date ascending", () => {
		const sorted = filterAndSortEarnings(items, {
			searchQuery: "",
			sortBy: "date-asc",
		});

		// June payout is earliest
		expect(sorted[0].confirmedAt).toContain("2026-06-30");
	});
});

describe("formatPayoutDate", () => {
	it("formats valid ISO dates into short localized format", () => {
		const formatted = formatPayoutDate("2026-08-28T14:32:00Z");
		expect(formatted).toContain("Aug 28, 2026");
	});

	it("returns TBD on invalid timestamp", () => {
		expect(formatPayoutDate("not-a-valid-date")).toBe("TBD");
	});
});

describe("getSampleEarnings data integrity", () => {
	it("provides valid 64-character hex transaction hashes for every payout", () => {
		const items = getSampleEarnings("GBXYZ");
		for (const item of items) {
			expect(item.txHash).toHaveLength(64);
			expect(/^[0-9a-fA-F]{64}$/.test(item.txHash)).toBe(true);
		}
	});
});
