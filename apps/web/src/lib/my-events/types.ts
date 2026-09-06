export type EventRole = "PARTICIPANT" | "JUDGE" | "ORGANIZER";

export type DeadlineType =
	| "EVENT_START"
	| "REGISTRATION_CLOSE"
	| "SUBMISSION_DEADLINE"
	| "JUDGING_DEADLINE"
	| "EVENT_CONCLUDED";

export interface NextDeadlineInfo {
	type: DeadlineType;
	targetDate: string; // ISO string for reliable JSON serialization
	labelKey: string;
	isUrgent: boolean; // < 24 hours remaining
	isExpired: boolean;
}

export interface MyEventItem {
	id: string;
	name: string;
	description: string | null;
	status:
		| "DRAFT"
		| "CREATED"
		| "FUNDED"
		| "LIVE"
		| "JUDGING"
		| "COMPLETED"
		| "CANCELLED";
	startsAt: string | null;
	endsAt: string | null;
	judgingDeadline: string | null;
	totalPrizeUsdc: string;
	roles: EventRole[];
	nextDeadline: NextDeadlineInfo;
	submissionCount: number;
	participantCount: number;
	escrowContractId: string | null;
}

export interface RemainingTime {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	totalSeconds: number;
	isExpired: boolean;
	isUrgent: boolean;
}

export type RoleFilterOption = "ALL" | EventRole;
export type StatusFilterOption = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface MyEventsFilter {
	role: RoleFilterOption;
	status: StatusFilterOption;
	searchQuery: string;
}

export interface MyEventsSummary {
	totalEvents: number;
	activeCount: number;
	totalPrizeUsdc: string;
	nextClosestDeadline: NextDeadlineInfo | null;
}
