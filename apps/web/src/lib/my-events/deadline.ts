import type {
	EventRole,
	MyEventItem,
	MyEventsSummary,
	NextDeadlineInfo,
	RemainingTime,
} from "./types";

/**
 * Calculates time remaining until a target deadline relative to reference date.
 * Pure function with zero dependencies, safe for both SSR and client hydration.
 */
export function parseRemainingTime(
	targetDate: Date | string | number,
	referenceDate: Date = new Date(),
): RemainingTime {
	const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
	const targetTime = target.getTime();

	if (Number.isNaN(targetTime)) {
		return {
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			totalSeconds: 0,
			isExpired: true,
			isUrgent: false,
		};
	}

	const diff = targetTime - referenceDate.getTime();

	if (diff <= 0) {
		return {
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			totalSeconds: 0,
			isExpired: true,
			isUrgent: false,
		};
	}

	const totalSeconds = Math.floor(diff / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const isUrgent = totalSeconds < 86400; // Under 24 hours

	return {
		days,
		hours,
		minutes,
		seconds,
		totalSeconds,
		isExpired: false,
		isUrgent,
	};
}

/**
 * Formats a RemainingTime structure into a clean, human-readable string.
 */
export function formatRemainingTime(remaining: RemainingTime): string {
	if (remaining.isExpired) {
		return "Concluded";
	}

	if (remaining.days > 0) {
		return `${remaining.days}d ${remaining.hours}h ${remaining.minutes}m`;
	}

	if (remaining.hours > 0) {
		return `${remaining.hours}h ${remaining.minutes}m ${remaining.seconds}s`;
	}

	return `${remaining.minutes}m ${remaining.seconds}s`;
}

/**
 * Derives the next relevant deadline for an event based on current status and user roles.
 */
export function calculateNextDeadline({
	startsAt,
	endsAt,
	judgingDeadline,
	status,
	roles,
	referenceDate = new Date(),
}: {
	startsAt: Date | string | null;
	endsAt: Date | string | null;
	judgingDeadline?: Date | string | null;
	status: string;
	roles: EventRole[];
	referenceDate?: Date;
}): NextDeadlineInfo {
	const isJudge = roles.includes("JUDGE");

	// Event is finalized or cancelled
	if (status === "COMPLETED" || status === "CANCELLED") {
		const target = endsAt
			? new Date(endsAt).toISOString()
			: new Date().toISOString();
		return {
			type: "EVENT_CONCLUDED",
			targetDate: target,
			labelKey: status === "COMPLETED" ? "statusCompleted" : "statusCancelled",
			isUrgent: false,
			isExpired: true,
		};
	}

	// Pre-LIVE states (DRAFT, CREATED, FUNDED)
	if (status === "DRAFT" || status === "CREATED" || status === "FUNDED") {
		if (startsAt) {
			const parsed = parseRemainingTime(startsAt, referenceDate);
			return {
				type: "EVENT_START",
				targetDate: new Date(startsAt).toISOString(),
				labelKey: "deadlineStartsIn",
				isUrgent: parsed.isUrgent,
				isExpired: parsed.isExpired,
			};
		}
		// If no start date set yet, treat as pending launch
		return {
			type: "EVENT_START",
			targetDate: referenceDate.toISOString(),
			labelKey: "deadlinePendingLaunch",
			isUrgent: false,
			isExpired: false,
		};
	}

	// LIVE state: submissions / registration active
	if (status === "LIVE") {
		if (endsAt) {
			const parsed = parseRemainingTime(endsAt, referenceDate);
			return {
				type: "SUBMISSION_DEADLINE",
				targetDate: new Date(endsAt).toISOString(),
				labelKey: "deadlineSubmissionsClose",
				isUrgent: parsed.isUrgent,
				isExpired: parsed.isExpired,
			};
		}
	}

	// JUDGING state: evaluations in progress
	if (status === "JUDGING") {
		// Use explicit judging deadline if provided, else fallback to endsAt + 7 days
		let targetTime: string;
		if (judgingDeadline) {
			targetTime = new Date(judgingDeadline).toISOString();
		} else if (endsAt) {
			const fallback = new Date(new Date(endsAt).getTime() + 7 * 86400 * 1000);
			targetTime = fallback.toISOString();
		} else {
			targetTime = new Date(
				referenceDate.getTime() + 7 * 86400 * 1000,
			).toISOString();
		}

		const parsed = parseRemainingTime(targetTime, referenceDate);
		return {
			type: "JUDGING_DEADLINE",
			targetDate: targetTime,
			labelKey: isJudge ? "deadlineJudgingDue" : "deadlineJudgingInProgress",
			isUrgent: parsed.isUrgent,
			isExpired: parsed.isExpired,
		};
	}

	// Fallback for any unmapped state
	const defaultDate = endsAt
		? new Date(endsAt).toISOString()
		: referenceDate.toISOString();
	const parsed = parseRemainingTime(defaultDate, referenceDate);
	return {
		type: "REGISTRATION_CLOSE",
		targetDate: defaultDate,
		labelKey: "deadlineActive",
		isUrgent: parsed.isUrgent,
		isExpired: parsed.isExpired,
	};
}

/**
 * Helper to produce explicit UTC and localized timestamp strings.
 */
export function formatTimezoneDetails(isoDateStr: string): {
	utc: string;
	formattedDate: string;
} {
	const d = new Date(isoDateStr);
	if (Number.isNaN(d.getTime())) {
		return { utc: "UTC", formattedDate: "TBD" };
	}

	const utc = d.toUTCString();
	const formattedDate = d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	return { utc, formattedDate };
}

/**
 * Computes top-level telemetry metrics for a user's events list.
 */
export function summarizeMyEvents(events: MyEventItem[]): MyEventsSummary {
	const totalEvents = events.length;
	const activeCount = events.filter(
		(e) =>
			e.status === "LIVE" || e.status === "JUDGING" || e.status === "FUNDED",
	).length;

	let totalPrizeNum = 0;
	let nextClosestDeadline: MyEventItem["nextDeadline"] | null = null;
	let minRemainingSec = Number.POSITIVE_INFINITY;

	const now = new Date();

	for (const evt of events) {
		const prizeVal = Number(evt.totalPrizeUsdc.replace(/,/g, ""));
		if (!Number.isNaN(prizeVal)) {
			totalPrizeNum += prizeVal;
		}

		if (!evt.nextDeadline.isExpired) {
			const target = new Date(evt.nextDeadline.targetDate).getTime();
			const diffSec = (target - now.getTime()) / 1000;
			if (diffSec > 0 && diffSec < minRemainingSec) {
				minRemainingSec = diffSec;
				nextClosestDeadline = evt.nextDeadline;
			}
		}
	}

	return {
		totalEvents,
		activeCount,
		totalPrizeUsdc: totalPrizeNum.toLocaleString("en-US", {
			maximumFractionDigits: 0,
		}),
		nextClosestDeadline,
	};
}
