import type { EventStatus } from "@/generated/prisma/enums";
import type {
	CancellationAuthResult,
	CancellationContext,
	CancellationPath,
	PreLiveCancelInput,
	PreLiveCancelRecord,
} from "./types";

/**
 * Determines the valid cancellation mechanism based on event status per ADR-006.
 * Pre-LIVE (CREATED, FUNDED) -> Automatic full refund via cancel_event.
 * Post-LIVE (LIVE, JUDGING)  -> Must route through resolver dispute adjudication.
 */
export function getCancellationPath(status: EventStatus): CancellationPath {
	switch (status) {
		case "CREATED":
		case "FUNDED":
			return "PRE_LIVE_REFUND";
		case "LIVE":
		case "JUDGING":
			return "POST_LIVE_DISPUTE";
		default:
			return "INELIGIBLE";
	}
}

/**
 * Validates whether the active caller can initiate cancellation.
 */
export function verifyCancellationEligibility(
	callerWallet: string | null,
	context: CancellationContext,
): CancellationAuthResult {
	if (!callerWallet?.trim()) {
		return {
			isAuthorized: false,
			path: "INELIGIBLE",
			reason: "WALLET_DISCONNECTED",
		};
	}

	if (
		callerWallet.trim().toUpperCase() !==
		context.organizerAddress.trim().toUpperCase()
	) {
		return {
			isAuthorized: false,
			path: "INELIGIBLE",
			reason: "NOT_ORGANIZER",
		};
	}

	const path = getCancellationPath(context.status);
	if (path === "INELIGIBLE") {
		return {
			isAuthorized: false,
			path: "INELIGIBLE",
			reason: `Event in status ${context.status} cannot be cancelled.`,
		};
	}

	return {
		isAuthorized: true,
		path,
	};
}

/**
 * Validates pre-LIVE cancellation inputs.
 */
export function validatePreLiveCancel(
	input: PreLiveCancelInput,
	context: CancellationContext,
): { isValid: boolean; error?: string } {
	const auth = verifyCancellationEligibility(input.organizerWallet, context);
	if (!auth.isAuthorized) {
		return { isValid: false, error: auth.reason };
	}

	if (auth.path !== "PRE_LIVE_REFUND") {
		return {
			isValid: false,
			error:
				"Event is already LIVE. Cancellation must route through dispute resolution.",
		};
	}

	return { isValid: true };
}

/**
 * Constructs a confirmed pre-LIVE cancellation record.
 */
export function createPreLiveCancelRecord(
	input: PreLiveCancelInput,
	context: CancellationContext,
	txHash: string,
): PreLiveCancelRecord {
	return {
		eventId: context.eventId,
		outcome: "REFUNDED_TO_ADMIN_WALLET",
		refundAmountUsdc: context.totalEscrowUsdc,
		adminWalletAddress: context.adminWalletAddress,
		organizerWallet: input.organizerWallet.trim(),
		txHash: txHash.trim(),
		cancelledAt: new Date().toISOString(),
	};
}
