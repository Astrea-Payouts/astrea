/**
 * Domain types for dispute adjudication and cancel-path distribution (Flow 5 / T01d / ADR-006).
 */

export type DisputeParticipantRole = "ORGANIZER" | "JUDGE" | "PARTICIPANT";

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";

export type DistributionSplit = {
	participantPercentage: number;
	organizerPercentage: number;
	participantAmountUsdc: number;
	organizerAmountUsdc: number;
};

export type CancelDisputeRecord = {
	id: string;
	eventId: string;
	eventTitle: string;
	totalEscrowUsdc: number;
	currency: string;
	organizerAddress: string;
	resolverAddress: string;
	registeredParticipantsCount: number;
	cancellationReason: string;
	requestedAt: string;
	status: DisputeStatus;
	resolution?: CancelDistributionRecord;
};

export type CancelDistributionInput = {
	disputeId: string;
	resolverWallet: string;
	participantPercentage: number;
	organizerPercentage: number;
	reasoning: string;
	explicitFullRefundConfirmed?: boolean;
};

export type CancelDistributionRecord = {
	disputeId: string;
	eventId: string;
	outcome: "CANCEL_DISTRIBUTION";
	totalEscrowUsdc: number;
	distribution: DistributionSplit;
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

export type CancelValidationResult = {
	isValid: boolean;
	errors: {
		auth?: string;
		percentage?: string;
		adr006?: string;
		reasoning?: string;
	};
};
