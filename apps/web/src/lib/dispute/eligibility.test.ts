import { describe, expect, it } from "vitest";
import {
	checkDisputeEligibility,
	createDisputeRecord,
	validateDisputeSubmission,
} from "./eligibility";
import type { DisputeEventContext } from "./types";

const mockEvent: DisputeEventContext = {
	id: "evt-test-1234",
	title: "Soroban DeFi Payout Challenge",
	organizerAddress: "GBORGANIZER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
	judgeAddress: "GBJUDGE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567",
	resolverAddress: "GBRESOLVER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
	participantAddresses: [
		"GBPARTICIPANT1111111111ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
		"GBPARTICIPANT2222222222ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
	],
	status: "LIVE",
};

describe("checkDisputeEligibility", () => {
	it("rejects empty or missing caller address", () => {
		const res1 = checkDisputeEligibility(mockEvent, "");
		expect(res1.eligible).toBe(false);
		expect(res1.role).toBe("unauthorized");

		const res2 = checkDisputeEligibility(mockEvent, "   ");
		expect(res2.eligible).toBe(false);
	});

	it("CRITICAL: strictly rejects resolver from opening dispute on their own escrow", () => {
		const res = checkDisputeEligibility(
			mockEvent,
			"GBRESOLVER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
		);
		expect(res.eligible).toBe(false);
		expect(res.role).toBe("resolver");
		expect(res.reason).toContain(
			"resolver cannot open a dispute on their own escrow",
		);
	});

	it("rejects resolver even with differing casing or whitespace", () => {
		const res = checkDisputeEligibility(
			mockEvent,
			"  gbresolver1234567890abcdefghijklmnopqrstuvwxyz12345  ",
		);
		expect(res.eligible).toBe(false);
		expect(res.role).toBe("resolver");
	});

	it("allows event organizer to open a dispute", () => {
		const res = checkDisputeEligibility(
			mockEvent,
			"GBORGANIZER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
		);
		expect(res.eligible).toBe(true);
		expect(res.role).toBe("organizer");
	});

	it("allows assigned judge to open a dispute", () => {
		const res = checkDisputeEligibility(
			mockEvent,
			"GBJUDGE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567",
		);
		expect(res.eligible).toBe(true);
		expect(res.role).toBe("judge");
	});

	it("allows registered participants to open a dispute", () => {
		const res = checkDisputeEligibility(
			mockEvent,
			"GBPARTICIPANT1111111111ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
		);
		expect(res.eligible).toBe(true);
		expect(res.role).toBe("participant");
	});

	it("rejects unauthorized random third-party wallet", () => {
		const res = checkDisputeEligibility(
			mockEvent,
			"GBRANDOMSTRANGER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
		);
		expect(res.eligible).toBe(false);
		expect(res.role).toBe("unauthorized");
		expect(res.reason).toContain(
			"Only registered participants, judges, or the event organizer",
		);
	});
});

describe("validateDisputeSubmission", () => {
	it("rejects submission if caller is not eligible", () => {
		const res = validateDisputeSubmission(
			{
				eventId: mockEvent.id,
				callerAddress: mockEvent.resolverAddress,
				reason: "I am the resolver and want to dispute this.",
			},
			mockEvent,
		);
		expect(res.valid).toBe(false);
		expect(res.role).toBe("resolver");
		expect(res.error).toContain("resolver cannot open a dispute");
	});

	it("rejects empty or whitespace reason", () => {
		const res = validateDisputeSubmission(
			{
				eventId: mockEvent.id,
				callerAddress: mockEvent.participantAddresses[0],
				reason: "   ",
			},
			mockEvent,
		);
		expect(res.valid).toBe(false);
		expect(res.error).toContain("Dispute reason is required");
	});

	it("rejects reason that is too short (< 15 chars)", () => {
		const res = validateDisputeSubmission(
			{
				eventId: mockEvent.id,
				callerAddress: mockEvent.participantAddresses[0],
				reason: "Unfair result",
			},
			mockEvent,
		);
		expect(res.valid).toBe(false);
		expect(res.error).toContain("at least 15 characters");
	});

	it("rejects invalid evidence URL format", () => {
		const res = validateDisputeSubmission(
			{
				eventId: mockEvent.id,
				callerAddress: mockEvent.participantAddresses[0],
				reason: "The judging score did not account for the deployed contract.",
				evidenceUrl: "ftp://invalid-url.org",
			},
			mockEvent,
		);
		expect(res.valid).toBe(false);
		expect(res.error).toContain("valid HTTP or HTTPS URL");
	});

	it("approves valid dispute submission with evidence URL", () => {
		const res = validateDisputeSubmission(
			{
				eventId: mockEvent.id,
				callerAddress: mockEvent.participantAddresses[0],
				reason:
					"The final judging criteria excluded my submission without notice.",
				evidenceUrl: "https://github.com/example/pr-evidence/123",
			},
			mockEvent,
		);
		expect(res.valid).toBe(true);
		expect(res.role).toBe("participant");
	});
});

describe("createDisputeRecord", () => {
	it("creates an immutable dispute record with expected fields", () => {
		const input = {
			eventId: mockEvent.id,
			milestoneId: "m1-architecture",
			callerAddress: mockEvent.participantAddresses[0],
			reason: "Unfair score evaluation given during judging round.",
			evidenceUrl: "https://example.com/evidence",
		};
		const record = createDisputeRecord(input, "participant");
		expect(record.id).toMatch(/^dsp-/);
		expect(record.eventId).toBe(mockEvent.id);
		expect(record.milestoneId).toBe("m1-architecture");
		expect(record.openedBy).toBe(mockEvent.participantAddresses[0]);
		expect(record.role).toBe("participant");
		expect(record.reason).toBe(input.reason);
		expect(record.evidenceUrl).toBe(input.evidenceUrl);
		expect(record.status).toBe("OPEN");
		expect(record.createdAt).toBeDefined();
	});
});
