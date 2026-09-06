/**
 * Domain types for dispute adjudication and resolver review (Flow 5 / T01c).
 */

export type DisputeParticipantRole = "ORGANIZER" | "JUDGE" | "PARTICIPANT";

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";

export type PriorJudgeWinner = {
	wallet: string;
	participantName?: string;
	submissionUrl?: string;
	notes?: string;
	recordedAt?: string;
};

export type DisputeRecord = {
	id: string;
	eventId: string;
	eventTitle: string;
	milestoneId: string;
	milestoneTitle: string;
	amountUsdc: string;
	claimantAddress: string;
	claimantRole: DisputeParticipantRole;
	reason: string;
	evidenceUrl?: string;
	status: DisputeStatus;
	createdAt: string;
	judgingDeadline: string;
	isJudgingDeadlinePassed: boolean;
	priorJudgeWinner: PriorJudgeWinner | null;
	resolverAddress: string;
	resolution?: DisputeResolutionRecord;
};

export type ResolutionOutcome = "RELEASE_TO_WINNER" | "CANCEL_DISTRIBUTION";

export type DisputeResolutionRecord = {
	disputeId: string;
	milestoneId: string;
	outcome: ResolutionOutcome;
	winnerWallet: string;
	amountUsdc: string;
	reasoning: string;
	resolverWallet: string;
	txHash: string;
	resolvedAt: string;
};

export type ResolverAuthCheck = {
	isAuthorized: boolean;
	reason?:
		| "WALLET_DISCONNECTED"
		| "NOT_DESIGNATED_RESOLVER"
		| "ALREADY_RESOLVED";
};

export type ReleaseResolutionInput = {
	disputeId: string;
	resolverWallet: string;
	winnerWallet: string;
	reasoning: string;
};

export type ResolutionValidationResult = {
	isValid: boolean;
	errors: {
		winnerWallet?: string;
		reasoning?: string;
		auth?: string;
	};
};
