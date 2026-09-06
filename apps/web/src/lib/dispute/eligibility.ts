import type {
	DisputeEligibilityResult,
	DisputeEventContext,
	DisputeRecord,
	DisputeRole,
	OpenDisputeInput,
} from "./types";

function norm(address?: string): string {
	return (address || "").trim().toUpperCase();
}

function isValidUrl(urlStr: string): boolean {
	try {
		const url = new URL(urlStr.trim());
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Validates whether the caller address is eligible to open a dispute.
 * Security rule per docs/product-flows.md Flow 5:
 * The resolver cannot open a dispute on their own escrow (server-side enforced).
 * Allowed parties: organizer, judge, and registered participants.
 */
export function checkDisputeEligibility(
	event: DisputeEventContext,
	callerAddress?: string,
): DisputeEligibilityResult {
	if (!callerAddress?.trim()) {
		return {
			eligible: false,
			role: "unauthorized",
			reason: "Wallet address is required to check dispute eligibility",
		};
	}

	const normalizedCaller = norm(callerAddress);

	// CRITICAL SECURITY RULE: The resolver on this escrow CANNOT open a dispute on their own escrow.
	if (normalizedCaller === norm(event.resolverAddress)) {
		return {
			eligible: false,
			role: "resolver",
			reason:
				"The dispute resolver cannot open a dispute on their own escrow (conflict of interest)",
		};
	}

	if (normalizedCaller === norm(event.organizerAddress)) {
		return {
			eligible: true,
			role: "organizer",
		};
	}

	if (normalizedCaller === norm(event.judgeAddress)) {
		return {
			eligible: true,
			role: "judge",
		};
	}

	const isParticipant = (event.participantAddresses || []).some(
		(p) => norm(p) === normalizedCaller,
	);
	if (isParticipant) {
		return {
			eligible: true,
			role: "participant",
		};
	}

	return {
		eligible: false,
		role: "unauthorized",
		reason:
			"Only registered participants, judges, or the event organizer can open a dispute",
	};
}

/**
 * Validates dispute submission inputs before creating the record.
 */
export function validateDisputeSubmission(
	input: OpenDisputeInput,
	event: DisputeEventContext,
): { valid: boolean; role?: DisputeRole; error?: string } {
	const eligibility = checkDisputeEligibility(event, input.callerAddress);
	if (!eligibility.eligible) {
		return {
			valid: false,
			role: eligibility.role,
			error: eligibility.reason || "Unauthorized to open dispute",
		};
	}

	const trimmedReason = (input.reason || "").trim();
	if (!trimmedReason) {
		return {
			valid: false,
			role: eligibility.role,
			error: "Dispute reason is required",
		};
	}

	if (trimmedReason.length < 15) {
		return {
			valid: false,
			role: eligibility.role,
			error:
				"Dispute reason must be at least 15 characters detailing the contested result or issue",
		};
	}

	if (trimmedReason.length > 2000) {
		return {
			valid: false,
			role: eligibility.role,
			error: "Dispute reason cannot exceed 2000 characters",
		};
	}

	if (input.evidenceUrl?.trim()) {
		if (!isValidUrl(input.evidenceUrl)) {
			return {
				valid: false,
				role: eligibility.role,
				error: "Evidence link must be a valid HTTP or HTTPS URL",
			};
		}
	}

	return {
		valid: true,
		role: eligibility.role,
	};
}

/**
 * Factory for creating an immutable dispute record.
 */
export function createDisputeRecord(
	input: OpenDisputeInput,
	role: DisputeRole,
): DisputeRecord {
	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).substring(2, 7);
	const id = `dsp-${input.eventId.slice(0, 8)}-${timestamp}-${randomSuffix}`;

	return {
		id,
		eventId: input.eventId,
		milestoneId: input.milestoneId,
		openedBy: input.callerAddress.trim(),
		role,
		reason: input.reason.trim(),
		evidenceUrl: input.evidenceUrl ? input.evidenceUrl.trim() : undefined,
		createdAt: new Date().toISOString(),
		status: "OPEN",
	};
}
