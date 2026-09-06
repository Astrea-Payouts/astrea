import type {
	EmergencyWithdrawState,
	EmergencyWithdrawStatus,
	EventStatus,
	OrganizerEvent,
} from "./types";

export const PRE_LIVE_STATUSES: readonly EventStatus[] = [
	"DRAFT",
	"CREATED",
	"STANDBY",
	"FUNDED",
	"CONDITIONS_MET",
] as const;

/**
 * Validates whether an event is eligible for explicit organizer publishing.
 * Product Rule (E03 sequencing rule 4): An event NEVER auto-publishes even when
 * conditionsMetAt is set. The organizer must explicitly initiate the publish action.
 */
export function canPublishEvent(
	event: Pick<OrganizerEvent, "status" | "conditionsMetAt">,
): boolean {
	const isPreLive = PRE_LIVE_STATUSES.includes(event.status);
	const hasConditionsMet = Boolean(event.conditionsMetAt);
	return isPreLive && hasConditionsMet;
}

/**
 * Pre-LIVE exit actions (cancel_event and emergency withdraw request) are only
 * permitted while the event has not yet transitioned to LIVE.
 * Once LIVE, judging, completion, or disputes govern the lifecycle.
 */
export function isPreLiveExitAllowed(status: EventStatus): boolean {
	return PRE_LIVE_STATUSES.includes(status);
}

export interface EmergencyWithdrawDisplay {
	status: EmergencyWithdrawStatus;
	isPendingResolver: boolean;
	isCompleted: boolean;
	canRequest: boolean;
	badgeVariant: "default" | "warning" | "success" | "destructive";
	labelKey: string;
	descriptionKey: string;
}

/**
 * ADR-006 & Issue #63 Requirement:
 * The emergency-withdraw request UI MUST NOT imply unilateral resolution.
 * When the organizer signs their half, it must explicitly show as pending the
 * resolver's co-signature, never as completed or released.
 */
export function getEmergencyWithdrawDisplay(
	state: EmergencyWithdrawState,
	eventStatus: EventStatus,
): EmergencyWithdrawDisplay {
	const preLiveAllowed = isPreLiveExitAllowed(eventStatus);

	if (
		state.status === "CO_SIGNED_RELEASED" ||
		(state.organizerSigned && state.resolverCoSigned)
	) {
		return {
			status: "CO_SIGNED_RELEASED",
			isPendingResolver: false,
			isCompleted: true,
			canRequest: false,
			badgeVariant: "success",
			labelKey: "emergencyCoSignedReleased",
			descriptionKey: "emergencyCoSignedReleasedDesc",
		};
	}

	if (
		state.status === "PENDING_RESOLVER_SIGNATURE" ||
		(state.organizerSigned && !state.resolverCoSigned)
	) {
		return {
			status: "PENDING_RESOLVER_SIGNATURE",
			isPendingResolver: true,
			isCompleted: false,
			canRequest: false,
			badgeVariant: "warning",
			labelKey: "emergencyPendingResolver",
			descriptionKey: "emergencyPendingResolverDesc",
		};
	}

	if (state.status === "REJECTED") {
		return {
			status: "REJECTED",
			isPendingResolver: false,
			isCompleted: false,
			canRequest: preLiveAllowed,
			badgeVariant: "destructive",
			labelKey: "emergencyRejected",
			descriptionKey: "emergencyRejectedDesc",
		};
	}

	return {
		status: "NONE",
		isPendingResolver: false,
		isCompleted: false,
		canRequest: preLiveAllowed,
		badgeVariant: "default",
		labelKey: "emergencyNotRequested",
		descriptionKey: "emergencyNotRequestedDesc",
	};
}

export interface StatusBadgeInfo {
	labelKey: string;
	colorClass: string;
	isDisputed: boolean;
	isCancelled: boolean;
	isLive: boolean;
}

export function getEventStatusBadge(status: EventStatus): StatusBadgeInfo {
	switch (status) {
		case "DRAFT":
		case "CREATED":
			return {
				labelKey: "statusCreated",
				colorClass: "border-zinc-700 bg-zinc-800/80 text-zinc-300",
				isDisputed: false,
				isCancelled: false,
				isLive: false,
			};
		case "STANDBY":
		case "FUNDED":
			return {
				labelKey: "statusFunded",
				colorClass: "border-blue-500/30 bg-blue-500/10 text-blue-400",
				isDisputed: false,
				isCancelled: false,
				isLive: false,
			};
		case "CONDITIONS_MET":
			return {
				labelKey: "statusConditionsMet",
				colorClass: "border-amber-500/30 bg-amber-500/10 text-amber-400",
				isDisputed: false,
				isCancelled: false,
				isLive: false,
			};
		case "LIVE":
			return {
				labelKey: "statusLive",
				colorClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
				isDisputed: false,
				isCancelled: false,
				isLive: true,
			};
		case "JUDGING":
			return {
				labelKey: "statusJudging",
				colorClass: "border-purple-500/30 bg-purple-500/10 text-purple-400",
				isDisputed: false,
				isCancelled: false,
				isLive: false,
			};
		case "COMPLETED":
			return {
				labelKey: "statusCompleted",
				colorClass: "border-sky-500/30 bg-sky-500/10 text-sky-400",
				isDisputed: false,
				isCancelled: false,
				isLive: false,
			};
		case "DISPUTED":
			return {
				labelKey: "statusDisputed",
				colorClass: "border-red-500/30 bg-red-500/10 text-red-400",
				isDisputed: true,
				isCancelled: false,
				isLive: false,
			};
		case "CANCELLED":
			return {
				labelKey: "statusCancelled",
				colorClass: "border-zinc-600 bg-zinc-800 text-zinc-400",
				isDisputed: false,
				isCancelled: true,
				isLive: false,
			};
		default:
			return {
				labelKey: "statusUnknown",
				colorClass: "border-zinc-700 bg-zinc-800 text-zinc-300",
				isDisputed: false,
				isCancelled: false,
				isLive: false,
			};
	}
}

export function calculateFundingProgress(
	current: number,
	target: number,
): {
	percentage: number;
	isFullyFunded: boolean;
	remaining: number;
} {
	if (target <= 0) {
		return { percentage: 100, isFullyFunded: true, remaining: 0 };
	}
	const percentage = Math.min(
		100,
		Math.max(0, Math.round((current / target) * 100)),
	);
	const isFullyFunded = current >= target;
	const remaining = Math.max(0, target - current);
	return { percentage, isFullyFunded, remaining };
}
