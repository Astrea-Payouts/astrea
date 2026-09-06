"use server";

import { randomBytes } from "node:crypto";
import {
	createPreLiveCancelRecord,
	validatePreLiveCancel,
} from "@/lib/cancellation/cancellation";
import type {
	CancellationContext,
	PreLiveCancelInput,
	PreLiveCancelRecord,
} from "@/lib/cancellation/types";

export type CancelActionResult = {
	success: boolean;
	record?: PreLiveCancelRecord;
	error?: string;
};

// Mock loader simulating database query for event escrow status
export async function getCancellationContext(
	eventId: string,
): Promise<CancellationContext> {
	// In production, this queries the Prisma/Core-Go database.
	// For demo/testing: event 'evt_pre_live_hackathon' is in FUNDED state;
	// other events default to LIVE unless specified.
	const isPreLive =
		eventId.includes("pre_live") || eventId === "evt_pre_live_hackathon";

	return {
		eventId,
		eventTitle: isPreLive
			? "Stellar Genesis Hackathon (Pre-Launch)"
			: "Soroban DeFi Frontier Hackathon",
		status: isPreLive ? "FUNDED" : "LIVE",
		totalEscrowUsdc: isPreLive ? 5000 : 10000,
		currency: "USDC",
		organizerAddress:
			"GDORGANIZER1111111111111111111111111111111111111111111111",
		adminWalletAddress:
			"GADMINWALLET22222222222222222222222222222222222222222222",
		registeredParticipantsCount: isPreLive ? 0 : 24,
	};
}

/**
 * Server action to execute pre-LIVE cancellation.
 * Signs cancel_event and triggers full automatic refund to AdminWallet.
 */
export async function cancelPreLiveEventAction(
	input: PreLiveCancelInput,
): Promise<CancelActionResult> {
	try {
		const context = await getCancellationContext(input.eventId);
		const validation = validatePreLiveCancel(input, context);

		if (!validation.isValid) {
			return {
				success: false,
				error: validation.error || "Pre-LIVE cancellation validation failed.",
			};
		}

		// Simulate on-chain Soroban contract cancel_event transaction
		await new Promise((resolve) => setTimeout(resolve, 1200));

		const txHash = randomBytes(32).toString("hex");
		const record = createPreLiveCancelRecord(input, context, txHash);

		return {
			success: true,
			record,
		};
	} catch (err) {
		console.error("Failed to execute cancel event action:", err);
		return {
			success: false,
			error:
				"An unexpected error occurred while executing the cancellation transaction.",
		};
	}
}
