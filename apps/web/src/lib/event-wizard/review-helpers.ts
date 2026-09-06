import type {
	DepositCheckResult,
	SigningPhase,
	TransactionStepConfig,
	WizardReviewData,
} from "./review-types";

export function checkDepositRequirement(
	totalPrizes: number,
	walletBalance: number,
	currency = "USDC",
): DepositCheckResult {
	const validPrizes = Math.max(0, totalPrizes || 0);
	const validBalance = Math.max(0, walletBalance || 0);
	const needsDeposit = validPrizes > validBalance;
	const requiredDeposit = needsDeposit ? validPrizes - validBalance : 0;

	return {
		needsDeposit,
		requiredDeposit,
		currentBalance: validBalance,
		totalPrizes: validPrizes,
		currency,
	};
}

export function getTransactionStepsInfo(
	phase: SigningPhase,
	needsDeposit: boolean,
): TransactionStepConfig {
	if (needsDeposit) {
		const isStep1 =
			phase === "IDLE" ||
			phase === "SIGNING_DEPOSIT" ||
			phase === "PENDING_DEPOSIT" ||
			phase === "DEPOSIT_CONFIRMED";

		return {
			totalSteps: 2,
			currentStepIndex: isStep1 ? 1 : 2,
			label: isStep1
				? "Step 1 of 2: Deposit Funds"
				: "Step 2 of 2: Initialize Escrow",
			actionTitle: isStep1 ? "Deposit Required USDC" : "Sign create_event",
		};
	}

	return {
		totalSteps: 1,
		currentStepIndex: 1,
		label: "Step 1 of 1: Initialize Escrow",
		actionTitle: "Sign create_event",
	};
}

export function isActionInFlight(phase: SigningPhase): boolean {
	return (
		phase === "SIGNING_DEPOSIT" ||
		phase === "PENDING_DEPOSIT" ||
		phase === "SIGNING_CREATE_EVENT" ||
		phase === "PENDING_CREATE_EVENT" ||
		phase === "SUCCESS"
	);
}

export function validateReviewData(data: Partial<WizardReviewData>): {
	isValid: boolean;
	missingSections: string[];
} {
	const missing: string[] = [];

	if (!data.details?.title || data.details.title.trim() === "") {
		missing.push("Event Details (Title)");
	}
	if (
		!data.details?.registrationDeadline ||
		!data.details?.submissionDeadline
	) {
		missing.push("Event Timeline (Deadlines)");
	}
	if (!data.prizes?.items || data.prizes.items.length === 0) {
		missing.push("Prizes (At least 1 prize required)");
	}
	if (!data.judges?.judgeAddresses || data.judges.judgeAddresses.length === 0) {
		missing.push("Judges (At least 1 judge address required)");
	}

	return {
		isValid: missing.length === 0,
		missingSections: missing,
	};
}

export function formatDateDisplay(isoString?: string): string {
	if (!isoString) return "Not specified";
	try {
		const d = new Date(isoString);
		if (Number.isNaN(d.getTime())) return isoString;
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return isoString;
	}
}
