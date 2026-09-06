export interface EventReviewDetails {
	title: string;
	description: string;
	websiteUrl?: string;
	registrationDeadline: string;
	submissionDeadline: string;
	judgingEnd: string;
}

export interface PrizeReviewItem {
	id: string;
	label: string;
	amount: number;
	currency?: string;
}

export interface EventReviewPrizes {
	items: PrizeReviewItem[];
	currency: string;
	totalAmount: number;
}

export interface EventReviewJudges {
	judgeAddresses: string[];
	resolverAddress: string;
	isAstreaDefaultResolver: boolean;
}

export interface EventReviewQuestions {
	enabled: boolean;
	questionsCount: number;
	questionsSummary?: string[];
}

export interface OrganizerWalletInfo {
	address: string;
	balance: number;
	currency?: string;
}

export interface WizardReviewData {
	details: EventReviewDetails;
	prizes: EventReviewPrizes;
	judges: EventReviewJudges;
	questions?: EventReviewQuestions;
	organizerWallet: OrganizerWalletInfo;
}

export type SigningPhase =
	| "IDLE"
	| "SIGNING_DEPOSIT"
	| "PENDING_DEPOSIT"
	| "DEPOSIT_CONFIRMED"
	| "SIGNING_CREATE_EVENT"
	| "PENDING_CREATE_EVENT"
	| "SUCCESS"
	| "ERROR";

export interface DepositCheckResult {
	needsDeposit: boolean;
	requiredDeposit: number;
	currentBalance: number;
	totalPrizes: number;
	currency: string;
}

export interface TransactionStepConfig {
	totalSteps: 1 | 2;
	currentStepIndex: 1 | 2;
	label: string;
	actionTitle: string;
	txHash?: string;
	createdEventId?: string;
}
