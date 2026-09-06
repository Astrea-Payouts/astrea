"use server";

import {
	createDisputeRecord,
	validateDisputeSubmission,
} from "@/lib/dispute/eligibility";
import { getDisputeEventContext } from "@/lib/dispute/events";
import type {
	OpenDisputeActionResult,
	OpenDisputeInput,
} from "@/lib/dispute/types";

export async function submitDisputeAction(
	input: OpenDisputeInput,
): Promise<OpenDisputeActionResult> {
	const event = await getDisputeEventContext(input.eventId);
	if (!event) {
		return {
			success: false,
			error: `Event not found: ${input.eventId}`,
		};
	}

	// CRITICAL SECURITY CHECK: Validated on server-side to reject resolvers
	const validation = validateDisputeSubmission(input, event);
	if (!validation.valid || !validation.role) {
		return {
			success: false,
			error: validation.error || "Dispute submission rejected by server",
		};
	}

	// Create dispute record
	const dispute = createDisputeRecord(input, validation.role);

	return {
		success: true,
		dispute,
	};
}
