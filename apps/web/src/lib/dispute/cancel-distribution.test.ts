import { describe, expect, it } from "vitest";
import {
	calculateDistribution,
	checkResolverAuth,
	createCancelDistributionRecord,
	validateCancelDistributionInput,
} from "./cancel-distribution";
import type { CancelDisputeRecord, CancelDistributionInput } from "./types";

const MOCK_RESOLVER =
	"GBRESOLVER7777777777777777777777777777777777777777777777";
const MOCK_ORGANIZER =
	"GDORGANIZER2222222222222222222222222222222222222222222222";

const mockCancelDispute: CancelDisputeRecord = {
	id: "disp_cancel_8812",
	eventId: "evt_soroban_defi",
	eventTitle: "Soroban DeFi Frontier Hackathon",
	totalEscrowUsdc: 10000,
	currency: "USDC",
	organizerAddress: MOCK_ORGANIZER,
	resolverAddress: MOCK_RESOLVER,
	registeredParticipantsCount: 24,
	cancellationReason:
		"Sponsor restructuring and unexpected pivot in foundation grant mandates.",
	requestedAt: "2026-09-04T10:00:00Z",
	status: "OPEN",
};

describe("Cancel Distribution Adjudication Engine (T01d / ADR-006)", () => {
	describe("checkResolverAuth", () => {
		it("rejects when wallet is disconnected", () => {
			const res = checkResolverAuth(null, mockCancelDispute);
			expect(res.isAuthorized).toBe(false);
			expect(res.reason).toBe("WALLET_DISCONNECTED");
		});

		it("rejects when wallet is not the designated resolver", () => {
			const randomUser =
				"GCRANDOM777777777777777777777777777777777777777777777777";
			const res = checkResolverAuth(randomUser, mockCancelDispute);
			expect(res.isAuthorized).toBe(false);
			expect(res.reason).toBe("NOT_DESIGNATED_RESOLVER");
		});

		it("rejects when dispute is already resolved", () => {
			const resolvedDispute: CancelDisputeRecord = {
				...mockCancelDispute,
				status: "RESOLVED",
			};
			const res = checkResolverAuth(MOCK_RESOLVER, resolvedDispute);
			expect(res.isAuthorized).toBe(false);
			expect(res.reason).toBe("ALREADY_RESOLVED");
		});

		it("authorizes when connected wallet matches designated resolver", () => {
			const res = checkResolverAuth(MOCK_RESOLVER, mockCancelDispute);
			expect(res.isAuthorized).toBe(true);
		});
	});

	describe("calculateDistribution", () => {
		it("accurately computes 50/50 split", () => {
			const split = calculateDistribution(10000, 50, 50);
			expect(split.participantAmountUsdc).toBe(5000);
			expect(split.organizerAmountUsdc).toBe(5000);
		});

		it("accurately computes 70/30 split", () => {
			const split = calculateDistribution(10000, 70, 30);
			expect(split.participantAmountUsdc).toBe(7000);
			expect(split.organizerAmountUsdc).toBe(3000);
		});
	});

	describe("validateCancelDistributionInput & ADR-006 Safety Rule", () => {
		const validInput: CancelDistributionInput = {
			disputeId: "disp_cancel_8812",
			resolverWallet: MOCK_RESOLVER,
			participantPercentage: 60,
			organizerPercentage: 40,
			reasoning:
				"Participants have built functional subgraphs and UI prototypes. 60% distribution compensates labor invested.",
		};

		it("passes on valid split and reasoned adjudication", () => {
			const res = validateCancelDistributionInput(
				validInput,
				mockCancelDispute,
			);
			expect(res.isValid).toBe(true);
			expect(Object.keys(res.errors)).toHaveLength(0);
		});

		it("rejects when percentages do not sum to 100", () => {
			const invalidInput = {
				...validInput,
				participantPercentage: 60,
				organizerPercentage: 50,
			};
			const res = validateCancelDistributionInput(
				invalidInput,
				mockCancelDispute,
			);
			expect(res.isValid).toBe(false);
			expect(res.errors.percentage).toContain("must sum to exactly 100%");
		});

		it("ADR-006: REJECTS 100% organizer refund without explicit override confirmation", () => {
			const unconfirmedFullRefund: CancelDistributionInput = {
				...validInput,
				participantPercentage: 0,
				organizerPercentage: 100,
				explicitFullRefundConfirmed: false,
			};
			const res = validateCancelDistributionInput(
				unconfirmedFullRefund,
				mockCancelDispute,
			);
			expect(res.isValid).toBe(false);
			expect(res.errors.adr006).toBeDefined();
			expect(res.errors.adr006).toContain("ADR-006 Safety Enforcement");
		});

		it("ADR-006: Allows 100% organizer refund ONLY when explicitly confirmed with rationale", () => {
			const confirmedFullRefund: CancelDistributionInput = {
				...validInput,
				participantPercentage: 0,
				organizerPercentage: 100,
				explicitFullRefundConfirmed: true,
				reasoning:
					"Audit confirmed no participant submissions or commits were pushed prior to cancel request.",
			};
			const res = validateCancelDistributionInput(
				confirmedFullRefund,
				mockCancelDispute,
			);
			expect(res.isValid).toBe(true);
			expect(res.errors.adr006).toBeUndefined();
		});

		it("enforces reasoning bounds between 15 and 2000 characters", () => {
			const tooShort = { ...validInput, reasoning: "Short" };
			const resShort = validateCancelDistributionInput(
				tooShort,
				mockCancelDispute,
			);
			expect(resShort.isValid).toBe(false);
			expect(resShort.errors.reasoning).toContain("at least 15 characters");
		});
	});

	describe("createCancelDistributionRecord", () => {
		it("creates a well-formed CancelDistributionRecord", () => {
			const input: CancelDistributionInput = {
				disputeId: "disp_cancel_8812",
				resolverWallet: MOCK_RESOLVER,
				participantPercentage: 60,
				organizerPercentage: 40,
				reasoning: "Awarded 60% to pool for verified participant submissions.",
			};
			const txHash =
				"e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7";

			const record = createCancelDistributionRecord(
				input,
				mockCancelDispute,
				txHash,
			);
			expect(record.disputeId).toBe("disp_cancel_8812");
			expect(record.outcome).toBe("CANCEL_DISTRIBUTION");
			expect(record.totalEscrowUsdc).toBe(10000);
			expect(record.distribution.participantAmountUsdc).toBe(6000);
			expect(record.distribution.organizerAmountUsdc).toBe(4000);
			expect(record.txHash).toBe(txHash);
			expect(record.resolvedAt).toBeDefined();
		});
	});
});
