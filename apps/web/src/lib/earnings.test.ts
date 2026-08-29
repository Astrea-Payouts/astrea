import { describe, expect, it } from "vitest";
import {
	calculateEarningsSummary,
	DEMO_PARTICIPANT_EARNINGS,
	type ParticipantEarningsItem,
} from "./earnings";

describe("calculateEarningsSummary", () => {
	it("returns zeroed summary when payouts list is empty", () => {
		const summary = calculateEarningsSummary([]);
		expect(summary).toEqual({
			totalEarnedUsdc: 0,
			totalPayoutsCount: 0,
			distinctEventsCount: 0,
			latestPayoutDate: null,
		});
	});

	it("correctly calculates total, counts, and latest date for demo payouts", () => {
		const summary = calculateEarningsSummary(DEMO_PARTICIPANT_EARNINGS);
		expect(summary.totalEarnedUsdc).toBe(4000.0);
		expect(summary.totalPayoutsCount).toBe(3);
		expect(summary.distinctEventsCount).toBe(3);
		expect(summary.latestPayoutDate).toBe("2026-08-25T14:32:00.000Z");
	});

	it("handles multiple payouts from the same event without overcounting distinct events", () => {
		const payouts: ParticipantEarningsItem[] = [
			{
				id: "p1",
				txHash: "hash1",
				amountUsdc: 150.25,
				amountFormatted: "150.25",
				confirmedAt: "2026-08-10T12:00:00.000Z",
				eventName: "Single Hackathon",
				eventId: "event-1",
				prizeRank: 1,
				network: "testnet",
			},
			{
				id: "p2",
				txHash: "hash2",
				amountUsdc: 349.75,
				amountFormatted: "349.75",
				confirmedAt: "2026-08-15T16:00:00.000Z",
				eventName: "Single Hackathon",
				eventId: "event-1",
				prizeRank: 2,
				network: "testnet",
			},
		];

		const summary = calculateEarningsSummary(payouts);
		expect(summary.totalEarnedUsdc).toBe(500.0);
		expect(summary.totalPayoutsCount).toBe(2);
		expect(summary.distinctEventsCount).toBe(1);
		expect(summary.latestPayoutDate).toBe("2026-08-15T16:00:00.000Z");
	});
});
