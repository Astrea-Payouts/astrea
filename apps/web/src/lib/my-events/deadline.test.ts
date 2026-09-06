import { describe, expect, it } from "vitest";
import {
	calculateNextDeadline,
	formatRemainingTime,
	formatTimezoneDetails,
	parseRemainingTime,
	summarizeMyEvents,
} from "./deadline";
import { getSampleEvents } from "./query";

describe("parseRemainingTime", () => {
	it("computes accurate days, hours, minutes, and seconds for future deadlines", () => {
		const ref = new Date("2026-09-01T12:00:00Z");
		// 2 days, 4 hours, 30 minutes, 15 seconds ahead
		const target = new Date(
			ref.getTime() +
				2 * 86400 * 1000 +
				4 * 3600 * 1000 +
				30 * 60 * 1000 +
				15 * 1000,
		);

		const res = parseRemainingTime(target, ref);
		expect(res.days).toBe(2);
		expect(res.hours).toBe(4);
		expect(res.minutes).toBe(30);
		expect(res.seconds).toBe(15);
		expect(res.isExpired).toBe(false);
		expect(res.isUrgent).toBe(false);
	});

	it("flags isUrgent=true when deadline is under 24 hours away", () => {
		const ref = new Date("2026-09-01T12:00:00Z");
		// 18 hours ahead
		const target = new Date(ref.getTime() + 18 * 3600 * 1000);

		const res = parseRemainingTime(target, ref);
		expect(res.days).toBe(0);
		expect(res.hours).toBe(18);
		expect(res.isUrgent).toBe(true);
		expect(res.isExpired).toBe(false);
	});

	it("handles past dates gracefully with isExpired=true and 0 time remaining", () => {
		const ref = new Date("2026-09-01T12:00:00Z");
		const past = new Date("2026-08-30T12:00:00Z");

		const res = parseRemainingTime(past, ref);
		expect(res.days).toBe(0);
		expect(res.hours).toBe(0);
		expect(res.minutes).toBe(0);
		expect(res.seconds).toBe(0);
		expect(res.isExpired).toBe(true);
		expect(res.isUrgent).toBe(false);
	});

	it("returns expired fallback for invalid date strings without crashing", () => {
		const ref = new Date("2026-09-01T12:00:00Z");
		const res = parseRemainingTime("not-a-valid-date", ref);

		expect(res.isExpired).toBe(true);
		expect(res.days).toBe(0);
	});
});

describe("formatRemainingTime", () => {
	it("formats multi-day durations cleanly", () => {
		const str = formatRemainingTime({
			days: 3,
			hours: 14,
			minutes: 25,
			seconds: 40,
			totalSeconds: 311140,
			isExpired: false,
			isUrgent: false,
		});
		expect(str).toBe("3d 14h 25m");
	});

	it("formats sub-day durations with seconds", () => {
		const str = formatRemainingTime({
			days: 0,
			hours: 6,
			minutes: 10,
			seconds: 30,
			totalSeconds: 22230,
			isExpired: false,
			isUrgent: true,
		});
		expect(str).toBe("6h 10m 30s");
	});

	it("formats sub-hour durations with minutes and seconds", () => {
		const str = formatRemainingTime({
			days: 0,
			hours: 0,
			minutes: 24,
			seconds: 15,
			totalSeconds: 1455,
			isExpired: false,
			isUrgent: true,
		});
		expect(str).toBe("24m 15s");
	});

	it("returns Concluded for expired states", () => {
		const str = formatRemainingTime({
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			totalSeconds: 0,
			isExpired: true,
			isUrgent: false,
		});
		expect(str).toBe("Concluded");
	});
});

describe("calculateNextDeadline", () => {
	const ref = new Date("2026-09-01T12:00:00Z");

	it("derives SUBMISSION_DEADLINE for LIVE events", () => {
		const endsAt = new Date(ref.getTime() + 3 * 86400 * 1000);
		const deadline = calculateNextDeadline({
			startsAt: new Date(ref.getTime() - 2 * 86400 * 1000),
			endsAt,
			status: "LIVE",
			roles: ["PARTICIPANT"],
			referenceDate: ref,
		});

		expect(deadline.type).toBe("SUBMISSION_DEADLINE");
		expect(deadline.labelKey).toBe("deadlineSubmissionsClose");
		expect(deadline.isExpired).toBe(false);
	});

	it("derives JUDGING_DEADLINE for JUDGING events with Judge role", () => {
		const judgingDeadline = new Date(ref.getTime() + 2 * 86400 * 1000);
		const deadline = calculateNextDeadline({
			startsAt: new Date(ref.getTime() - 10 * 86400 * 1000),
			endsAt: new Date(ref.getTime() - 1 * 86400 * 1000),
			judgingDeadline,
			status: "JUDGING",
			roles: ["JUDGE"],
			referenceDate: ref,
		});

		expect(deadline.type).toBe("JUDGING_DEADLINE");
		expect(deadline.labelKey).toBe("deadlineJudgingDue");
		expect(deadline.isExpired).toBe(false);
	});

	it("derives EVENT_START for FUNDED events", () => {
		const startsAt = new Date(ref.getTime() + 4 * 86400 * 1000);
		const deadline = calculateNextDeadline({
			startsAt,
			endsAt: new Date(startsAt.getTime() + 7 * 86400 * 1000),
			status: "FUNDED",
			roles: ["ORGANIZER"],
			referenceDate: ref,
		});

		expect(deadline.type).toBe("EVENT_START");
		expect(deadline.labelKey).toBe("deadlineStartsIn");
		expect(deadline.isExpired).toBe(false);
	});

	it("derives EVENT_CONCLUDED for COMPLETED events", () => {
		const deadline = calculateNextDeadline({
			startsAt: new Date(ref.getTime() - 30 * 86400 * 1000),
			endsAt: new Date(ref.getTime() - 5 * 86400 * 1000),
			status: "COMPLETED",
			roles: ["PARTICIPANT"],
			referenceDate: ref,
		});

		expect(deadline.type).toBe("EVENT_CONCLUDED");
		expect(deadline.labelKey).toBe("statusCompleted");
		expect(deadline.isExpired).toBe(true);
	});
});

describe("formatTimezoneDetails", () => {
	it("returns readable UTC and formatted strings", () => {
		const details = formatTimezoneDetails("2026-09-15T18:00:00Z");
		expect(details.utc).toContain("Sep 2026");
		expect(details.formattedDate).toBeDefined();
	});

	it("handles invalid dates safely", () => {
		const details = formatTimezoneDetails("invalid");
		expect(details.utc).toBe("UTC");
		expect(details.formattedDate).toBe("TBD");
	});
});

describe("summarizeMyEvents", () => {
	it("aggregates events count, active count, and prize sum accurately", () => {
		const dummyWallet = "GBXYZ...TESTWALLET";
		const sampleEvents = getSampleEvents(dummyWallet);

		const summary = summarizeMyEvents(sampleEvents);
		expect(summary.totalEvents).toBe(4);
		expect(summary.activeCount).toBe(3); // LIVE, JUDGING, FUNDED
		expect(Number(summary.totalPrizeUsdc.replace(/,/g, ""))).toBe(57500); // 15000 + 7500 + 25000 + 10000
		expect(summary.nextClosestDeadline).toBeDefined();
	});
});
