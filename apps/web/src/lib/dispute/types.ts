export type DisputeRole =
	| "organizer"
	| "judge"
	| "participant"
	| "resolver"
	| "unauthorized";

export interface DisputeEventContext {
	id: string;
	title: string;
	organizerAddress: string;
	judgeAddress: string;
	resolverAddress: string;
	participantAddresses: string[];
	status: string;
	prizes?: Array<{
		id: string;
		title: string;
		amountUsdc: number;
		status: string;
	}>;
}

export interface DisputeEligibilityResult {
	eligible: boolean;
	role: DisputeRole;
	reason?: string;
}

export interface DisputeRecord {
	id: string;
	eventId: string;
	milestoneId?: string;
	openedBy: string;
	role: DisputeRole;
	reason: string;
	evidenceUrl?: string;
	createdAt: string;
	status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CANCELLED";
}

export interface OpenDisputeInput {
	eventId: string;
	milestoneId?: string;
	callerAddress: string;
	reason: string;
	evidenceUrl?: string;
}

export interface OpenDisputeActionResult {
	success: boolean;
	dispute?: DisputeRecord;
	error?: string;
}
