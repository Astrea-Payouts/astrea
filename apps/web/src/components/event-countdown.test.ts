import { describe, expect, it } from "vitest";
import { calculateTimeRemaining } from "./event-countdown";

describe("EventCountdown Calculator", () => {
	it("correctly computes days, hours, minutes, and seconds remaining", () => {
		const now = Date.now();
		// 2 days + 3 hours + 4 minutes + 5 seconds in future
		const futureMs = now + (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;

		const remaining = calculateTimeRemaining(futureMs);

		expect(remaining.isExpired).toBe(false);
		expect(remaining.days).toBe(2);
		expect(remaining.hours).toBe(3);
		expect(remaining.minutes).toBe(4);
		expect(remaining.seconds).toBe(5);
	});

	it("identifies expired deadlines gracefully", () => {
		const pastMs = Date.now() - 10000;
		const remaining = calculateTimeRemaining(pastMs);

		expect(remaining.isExpired).toBe(true);
		expect(remaining.totalMs).toBe(0);
		expect(remaining.days).toBe(0);
		expect(remaining.hours).toBe(0);
		expect(remaining.minutes).toBe(0);
		expect(remaining.seconds).toBe(0);
	});

	it("parses ISO date strings accurately", () => {
		const futureIso = new Date(Date.now() + 3600 * 1000).toISOString();
		const remaining = calculateTimeRemaining(futureIso);

		expect(remaining.isExpired).toBe(false);
		expect(remaining.totalMs).toBeGreaterThan(0);
		expect(remaining.hours).toBeLessThanOrEqual(1);
	});
});
