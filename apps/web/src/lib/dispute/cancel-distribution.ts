import type {
	CancelDisputeRecord,
	CancelDistributionInput,
	CancelDistributionRecord,
	CancelValidationResult,
	DistributionSplit,
	ResolverAuthCheck,
} from "./types";

/**
 * Checks if the caller is the authorized escrow dispute resolver.
 */
export function checkResolverAuth(
	walletAddress: string | null,
	dispute: CancelDisputeRecord,
): ResolverAuthCheck {
	if (!walletAddress?.trim()) {
		return {
			isAuthorized: false,
			reason: "WALLET_DISCONNECTED",
		};
	}

	if (dispute.status === "RESOLVED") {
		return {
			isAuthorized: false,
			reason: "ALREADY_RESOLVED",
		};
	}

	if (
		walletAddress.trim().toUpperCase() !==
		dispute.resolverAddress.trim().toUpperCase()
	) {
		return {
			isAuthorized: false,
			reason: "NOT_DESIGNATED_RESOLVER",
		};
	}

	return {
		isAuthorized: true,
	};
}

/**
 * Computes exact USDC distribution split based on percentages.
 */
export function calculateDistribution(
	totalUsdc: number,
	participantPct: number,
	organizerPct: number,
): DistributionSplit {
	const participantAmount = Number(
		((totalUsdc * participantPct) / 100).toFixed(2),
	);
	const organizerAmount = Number((totalUsdc - participantAmount).toFixed(2));

	return {
		participantPercentage: participantPct,
		organizerPercentage: organizerPct,
		participantAmountUsdc: participantAmount,
		organizerAmountUsdc: organizerAmount,
	};
}

/**
 * Validates the cancel-path distribution input.
 * CRITICAL ADR-006 RULE: Never allows an automatic or unconditional full refund to the organizer
 * when an event has active participants who already invested work.
 */
export function validateCancelDistributionInput(
	input: CancelDistributionInput,
	dispute: CancelDisputeRecord,
): CancelValidationResult {
	const errors: CancelValidationResult["errors"] = {};

	const authCheck = checkResolverAuth(input.resolverWallet, dispute);
	if (!authCheck.isAuthorized) {
		errors.auth = authCheck.reason;
	}

	if (
		typeof input.participantPercentage !== "number" ||
		typeof input.organizerPercentage !== "number" ||
		Number.isNaN(input.participantPercentage) ||
		Number.isNaN(input.organizerPercentage)
	) {
		errors.percentage = "Valid distribution percentages are required.";
	} else if (
		input.participantPercentage < 0 ||
		input.organizerPercentage < 0 ||
		input.participantPercentage + input.organizerPercentage !== 100
	) {
		errors.percentage =
			"Participant and organizer percentages must sum to exactly 100%.";
	}

	// ADR-006 Safety Constraint:
	// A live event with participants cannot be 100% refunded to the organizer
	// without explicit confirmation and strict manual acknowledgment.
	if (
		input.organizerPercentage === 100 &&
		input.participantPercentage === 0 &&
		dispute.registeredParticipantsCount > 0 &&
		!input.explicitFullRefundConfirmed
	) {
		errors.adr006 =
			"ADR-006 Safety Enforcement: A LIVE event with registered participants cannot default to 100% organizer refund without explicit override confirmation.";
	}

	const trimmedReason = input.reasoning?.trim() || "";
	if (!trimmedReason) {
		errors.reasoning = "Adjudication reasoning is required.";
	} else if (trimmedReason.length < 15) {
		errors.reasoning = "Adjudication reasoning must be at least 15 characters.";
	} else if (trimmedReason.length > 2000) {
		errors.reasoning = "Adjudication reasoning cannot exceed 2000 characters.";
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
}

/**
 * Constructs a confirmed CancelDistributionRecord.
 */
export function createCancelDistributionRecord(
	input: CancelDistributionInput,
	dispute: CancelDisputeRecord,
	txHash: string,
): CancelDistributionRecord {
	const distribution = calculateDistribution(
		dispute.totalEscrowUsdc,
		input.participantPercentage,
		input.organizerPercentage,
	);

	return {
		disputeId: dispute.id,
		eventId: dispute.eventId,
		outcome: "CANCEL_DISTRIBUTION",
		totalEscrowUsdc: dispute.totalEscrowUsdc,
		distribution,
		reasoning: input.reasoning.trim(),
		resolverWallet: input.resolverWallet.trim(),
		txHash: txHash.trim(),
		resolvedAt: new Date().toISOString(),
	};
}
