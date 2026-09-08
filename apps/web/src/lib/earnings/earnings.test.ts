import { describe, expect, it, vi } from "vitest";
import { db as mockDb } from "@/lib/db";
import { getParticipantEarnings, getSampleEarnings } from "./query";
import {
	calculateEarningsSummary,
	filterAndSortEarnings,
	formatPayoutDate,
} from "./summary";

vi.mock("@/lib/db", () => ({
	db: {
		payout: {
			findMany: vi.fn(),
		},
	},
}));

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

describe("getParticipantEarnings", () => {
	it("returns an empty array when wallet is undefined or null", async () => {
		const resultNull = await getParticipantEarnings(null);
		const resultUndefined = await getParticipantEarnings(undefined);

		expect(resultNull).toEqual([]);
		expect(resultUndefined).toEqual([]);
	});

	it("returns an empty array for blank or oversized wallet references", async () => {
		expect(await getParticipantEarnings("")).toEqual([]);
		expect(await getParticipantEarnings("   ")).toEqual([]);
		expect(await getParticipantEarnings("x".repeat(129))).toEqual([]);
	});

	it("returns an empty array when database is unconfigured", async () => {
		const prevEnv = process.env.DATABASE_URL;
		delete process.env.DATABASE_URL;

		const result = await getParticipantEarnings("wallet-123");
		expect(result).toEqual([]);

		if (prevEnv) process.env.DATABASE_URL = prevEnv;
	});
});

describe("getParticipantEarnings failure modes", () => {
	const findManyMock = () =>
		mockDb.payout.findMany as unknown as ReturnType<typeof vi.fn>;

	it("returns empty (never sample data) when the database query throws", async () => {
		findManyMock().mockRejectedValueOnce(new Error("connection refused"));
		const result = await getParticipantEarnings("wallet-verified-1");
		expect(result).toEqual([]);
		expect(JSON.stringify(result)).not.toContain("pay_");
	});

	it("returns empty for a verified wallet with zero payouts", async () => {
		findManyMock().mockResolvedValueOnce([]);
		const result = await getParticipantEarnings("wallet-verified-2");
		expect(result).toEqual([]);
	});
});
