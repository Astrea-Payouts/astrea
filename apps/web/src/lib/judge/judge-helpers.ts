import type {
	JudgePrize,
	JudgeSignerInfo,
	JudgeSigningStage,
	PrizeReviewStatus,
} from "./types";

/**
 * Winner assignment requires:
 * 1. Prize is currently in PENDING_REVIEW or WINNER_ASSIGNED (can re-pick before approve)
 * 2. Event is in JUDGING or LIVE phase
 */
export function canAssignWinner(
	prizeStatus: PrizeReviewStatus,
	eventStatus: string,
): boolean {
	if (
		prizeStatus === "APPROVED" ||
		prizeStatus === "RELEASED" ||
		prizeStatus === "DISPUTED"
	) {
		return false;
	}
	return eventStatus === "JUDGING" || eventStatus === "LIVE";
}

/**
 * Approving the prize payment requires:
 * 1. Winner is assigned
 * 2. Winner has verified USDC trustline (ADR-004)
 * 3. Prize is WINNER_ASSIGNED and not already approved/released
 */
export function canSignApprove(
	prize: Pick<
		JudgePrize,
		"status" | "assignedWinnerWallet" | "winnerTrustlineVerified"
	>,
): boolean {
	if (!prize.assignedWinnerWallet) return false;
	if (!prize.winnerTrustlineVerified) return false;
	return prize.status === "WINNER_ASSIGNED";
}

/**
 * Releasing the prize payment requires:
 * 1. Prize has been APPROVED first (strict 2-transaction sequence per ADR-003)
 * 2. Winner address is locked in
 */
export function canSignRelease(
	prize: Pick<JudgePrize, "status" | "assignedWinnerWallet">,
): boolean {
	if (!prize.assignedWinnerWallet) return false;
	return prize.status === "APPROVED";
}

/**
 * Calculates multisig progress and threshold state for Stellar multisig judge accounts
 */
export function calculateMultisigProgress(signerInfo: JudgeSignerInfo): {
	isThresholdMet: boolean;
	remainingSignatures: number;
	progressPercent: number;
	displayString: string;
} {
	if (!signerInfo.isMultisig) {
		const isMet = signerInfo.collectedSignatures >= 1;
		return {
			isThresholdMet: isMet,
			remainingSignatures: isMet ? 0 : 1,
			progressPercent: isMet ? 100 : 0,
			displayString: isMet
				? "Single Signature Verified"
				: "1 Signature Required",
		};
	}

	const required = Math.max(1, signerInfo.requiredSignatures);
	const collected = Math.max(0, signerInfo.collectedSignatures);
	const remaining = Math.max(0, required - collected);
	const progressPercent = Math.min(
		100,
		Math.round((collected / required) * 100),
	);

	return {
		isThresholdMet: collected >= required,
		remainingSignatures: remaining,
		progressPercent,
		displayString: `${collected} of ${required} signatures collected`,
	};
}

/**
 * Human-readable mapping of the 2-step signing stage
 */
export function describeSigningStage(stage: JudgeSigningStage): {
	label: string;
	isOngoing: boolean;
	isFinished: boolean;
	isFailed: boolean;
} {
	switch (stage) {
		case "APPROVE_BUILDING":
		case "APPROVE_SIGNING":
		case "APPROVE_PENDING_CONFIRMATION":
			return {
				label: "Approving Prize on Stellar Ledger…",
				isOngoing: true,
				isFinished: false,
				isFailed: false,
			};
		case "APPROVED":
			return {
				label: "Prize Approved. Ready for Final Release.",
				isOngoing: false,
				isFinished: false,
				isFailed: false,
			};
		case "RELEASE_BUILDING":
		case "RELEASE_SIGNING":
		case "RELEASE_PENDING_CONFIRMATION":
			return {
				label: "Releasing Funds to Winner Wallet…",
				isOngoing: true,
				isFinished: false,
				isFailed: false,
			};
		case "RELEASED":
			return {
				label: "Prize Released and Paid Out On-Chain!",
				isOngoing: false,
				isFinished: true,
				isFailed: false,
			};
		case "FAILED":
			return {
				label: "Transaction Signing or Submission Failed",
				isOngoing: false,
				isFinished: false,
				isFailed: true,
			};
		default:
			return {
				label: "Ready to Sign",
				isOngoing: false,
				isFinished: false,
				isFailed: false,
			};
	}
}

export function truncateStellarKey(key: string, head = 6, tail = 6): string {
	if (!key || key.length <= head + tail) return key;
	return `${key.slice(0, head)}…${key.slice(-tail)}`;
}
