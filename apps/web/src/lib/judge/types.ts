/**
 * Judge Panel Types (U05)
 * Architecture reference: docs/product-flows.md Flow 4, ADR-003, ADR-004
 */

export type PrizeReviewStatus =
	| "PENDING_REVIEW"
	| "WINNER_ASSIGNED"
	| "APPROVED"
	| "RELEASED"
	| "DISPUTED";

export interface JudgeSignerInfo {
	address: string;
	isMultisig: boolean;
	totalSigners: number;
	requiredSignatures: number;
	collectedSignatures: number;
}

export interface JudgeSubmission {
	id: string;
	participantWallet: string;
	projectTitle: string;
	url: string;
	submittedAt: string;
	score?: number;
	notes?: string;
}

export interface JudgePrize {
	id: string;
	title: string;
	amount: number;
	currency: string;
	status: PrizeReviewStatus;
	assignedWinnerWallet?: string;
	winnerTrustlineVerified?: boolean;
	approveTxHash?: string;
	releaseTxHash?: string;
	submissions: JudgeSubmission[];
}

export type JudgeSigningStage =
	| "IDLE"
	| "APPROVE_BUILDING"
	| "APPROVE_SIGNING"
	| "APPROVE_PENDING_CONFIRMATION"
	| "APPROVED"
	| "RELEASE_BUILDING"
	| "RELEASE_SIGNING"
	| "RELEASE_PENDING_CONFIRMATION"
	| "RELEASED"
	| "FAILED";
