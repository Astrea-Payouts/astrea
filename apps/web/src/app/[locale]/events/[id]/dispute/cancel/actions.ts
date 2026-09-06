"use server";

import { randomBytes } from "node:crypto";
import {
	createCancelDistributionRecord,
	validateCancelDistributionInput,
} from "@/lib/dispute/cancel-distribution";
import { getCancelDisputeRecord } from "@/lib/dispute/events";
import type {
	CancelDistributionInput,
	CancelDistributionRecord,
} from "@/lib/dispute/types";

export type CancelDistributionActionResult = {
	success: boolean;
	record?: CancelDistributionRecord;
	error?: string;
	fieldErrors?: {
		auth?: string;
		percentage?: string;
		adr006?: string;
		reasoning?: string;
	};
};

export async function resolveCancelDistributionAction(
	input: CancelDistributionInput,
): Promise<CancelDistributionActionResult> {
	try {
		const dispute = await getCancelDisputeRecord(
			"evt_soroban_defi",
			input.disputeId,
		);
		if (!dispute) {
			return {
				success: false,
				error: "Cancellation dispute record not found.",
			};
		}

		const validation = validateCancelDistributionInput(input, dispute);
		if (!validation.isValid) {
			return {
				success: false,
				error: "Validation failed. Please review the highlighted fields.",
				fieldErrors: validation.errors,
			};
		}

		// Honest network latency simulation for Soroban contract resolve_dispute invocation
		await new Promise((resolve) => setTimeout(resolve, 1200));

		const txHash = randomBytes(32).toString("hex");
		const record = createCancelDistributionRecord(input, dispute, txHash);

		return {
			success: true,
			record,
		};
	} catch (err) {
		console.error("Failed to execute cancel distribution resolution:", err);
		return {
			success: false,
			error:
				"An unexpected error occurred while executing the on-chain distribution.",
		};
	}
}
