import type {
	DisputeRecord,
	DisputeResolutionRecord,
	ReleaseResolutionInput,
	ResolutionValidationResult,
	ResolverAuthCheck,
} from "./types";

/**
 * Validates whether a given Stellar public key matches standard public key formatting (G... 56 chars).
 */
export function isValidStellarAddress(address: string): boolean {
	if (!address) return false;
	const trimmed = address.trim();
	return /^G[A-Z0-9]{55}$/.test(trimmed);
}

/**
 * Checks if the currently active wallet is authorized to adjudicate and sign this dispute.
 * Security rule: Only the designated resolver published on the escrow contract can resolve.
 */
export function checkResolverAuth(
	walletAddress: string | null,
	dispute: DisputeRecord,
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
 * Validates the inputs provided by the resolver for a release-path resolution.
 */
export function validateReleaseResolutionInput(
	input: ReleaseResolutionInput,
	dispute: DisputeRecord,
): ResolutionValidationResult {
	const errors: ResolutionValidationResult["errors"] = {};

	const authCheck = checkResolverAuth(input.resolverWallet, dispute);
	if (!authCheck.isAuthorized) {
		errors.auth = authCheck.reason;
	}

	if (!input.winnerWallet?.trim()) {
		errors.winnerWallet = "Winner wallet address is required.";
	} else if (!isValidStellarAddress(input.winnerWallet)) {
		errors.winnerWallet =
			"Winner wallet must be a valid 56-character Stellar public key starting with 'G'.";
	}

	const trimmedReasoning = input.reasoning ? input.reasoning.trim() : "";
	if (!trimmedReasoning) {
		errors.reasoning = "Adjudication rationale is required.";
	} else if (trimmedReasoning.length < 15) {
		errors.reasoning = "Adjudication rationale must be at least 15 characters.";
	} else if (trimmedReasoning.length > 2000) {
		errors.reasoning = "Adjudication rationale cannot exceed 2000 characters.";
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
}

/**
 * Creates a formal DisputeResolutionRecord upon confirmed transaction.
 */
export function createResolutionRecord(
	input: ReleaseResolutionInput,
	dispute: DisputeRecord,
	txHash: string,
): DisputeResolutionRecord {
	return {
		disputeId: dispute.id,
		milestoneId: dispute.milestoneId,
		outcome: "RELEASE_TO_WINNER",
		winnerWallet: input.winnerWallet.trim(),
		amountUsdc: dispute.amountUsdc,
		reasoning: input.reasoning.trim(),
		resolverWallet: input.resolverWallet.trim(),
		txHash: txHash.trim(),
		resolvedAt: new Date().toISOString(),
	};
}
