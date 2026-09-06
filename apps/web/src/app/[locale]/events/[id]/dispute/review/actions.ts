"use server";

import { randomBytes } from "node:crypto";
import { getDisputeRecord } from "@/lib/dispute/events";
import {
	createResolutionRecord,
	validateReleaseResolutionInput,
} from "@/lib/dispute/resolution";
import type {
	DisputeResolutionRecord,
	ReleaseResolutionInput,
} from "@/lib/dispute/types";

export type ResolveDisputeActionResult = {
	success: boolean;
	record?: DisputeResolutionRecord;
	error?: string;
	fieldErrors?: {
		winnerWallet?: string;
		reasoning?: string;
		auth?: string;
	};
};

/**
 * Server action to execute dispute resolution via release-path signing.
 * Enforces resolver authorization and input verification server-side.
 */
export async function resolveDisputeReleaseAction(
	input: ReleaseResolutionInput,
): Promise<ResolveDisputeActionResult> {
	try {
		// 1. Fetch current dispute record
		const dispute = await getDisputeRecord(
			"evt_soroban_hackathon",
			input.disputeId,
		);
		if (!dispute) {
			return {
				success: false,
				error: "Dispute record not found.",
			};
		}

		// 2. Server-side validation
		const validation = validateReleaseResolutionInput(input, dispute);
		if (!validation.isValid) {
			return {
				success: false,
				error: "Validation failed. Please review the highlighted fields.",
				fieldErrors: validation.errors,
			};
		}

		// 3. Simulate on-chain Soroban invocation of resolve_dispute
		// In production, this constructs and submits the Soroban transaction to Horizon/RPC
		await new Promise((resolve) => setTimeout(resolve, 1200));

		// Generate realistic 64-character hex transaction hash
		const txHash = randomBytes(32).toString("hex");

		// 4. Create verified resolution record
		const record = createResolutionRecord(input, dispute, txHash);

		return {
			success: true,
			record,
		};
	} catch (err) {
		console.error("Failed to execute dispute resolution action:", err);
		return {
			success: false,
			error:
				"An unexpected error occurred while submitting resolution on-chain.",
		};
	}
}
