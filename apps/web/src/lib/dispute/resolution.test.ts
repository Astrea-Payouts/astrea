import { describe, expect, it } from "vitest";
import {
	checkResolverAuth,
	createResolutionRecord,
	isValidStellarAddress,
	validateReleaseResolutionInput,
} from "./resolution";
import type { DisputeRecord, ReleaseResolutionInput } from "./types";

const MOCK_RESOLVER =
	"GBRESOLVER7777777777777777777777777777777777777777777777";
const MOCK_WINNER = "GAWINNER222222222222222222222222222222222222222222222222";

const mockDispute: DisputeRecord = {
	id: "disp_9981",
	eventId: "evt_soroban_hackathon",
	eventTitle: "Stellar Global Buildathon 2026",
	milestoneId: "m1_first_place",
	milestoneTitle: "1st Place Grand Prize",
	amountUsdc: "5,000",
	claimantAddress: "GAPARTICIPANT22222222222222222222222222222222222222222222",
	claimantRole: "PARTICIPANT",
	reason:
		"The judging deadline passed 48 hours ago and the assigned judge went completely silent without signing the release.",
	status: "OPEN",
	createdAt: "2026-09-04T12:00:00Z",
	judgingDeadline: "2026-09-02T23:59:59Z",
	isJudgingDeadlinePassed: true,
	priorJudgeWinner: {
		wallet: MOCK_WINNER,
		participantName: "stellar-artisan",
		submissionUrl: "https://github.com/stellar-artisan/astrea-soroban-poc",
		notes: "Score: 98/100 - Highest overall technical architecture mark.",
		recordedAt: "2026-09-02T18:00:00Z",
	},
	resolverAddress: MOCK_RESOLVER,
};

describe("Dispute Resolution Engine (T01c)", () => {
	describe("isValidStellarAddress", () => {
		it("accepts a standard 56-character G-address", () => {
			expect(isValidStellarAddress(MOCK_RESOLVER)).toBe(true);
			expect(isValidStellarAddress(MOCK_WINNER)).toBe(true);
		});

		it("rejects addresses with invalid lengths or prefixes", () => {
			expect(isValidStellarAddress("")).toBe(false);
			expect(isValidStellarAddress("G123")).toBe(false);
			expect(
				isValidStellarAddress(
					"S12345678901234567890123456789012345678901234567890123456",
				),
			).toBe(false);
			expect(
				isValidStellarAddress(
					"CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
				),
			).toBe(false);
		});
	});

	describe("checkResolverAuth", () => {
		it("rejects when wallet is disconnected", () => {
			const res = checkResolverAuth(null, mockDispute);
			expect(res.isAuthorized).toBe(false);
			expect(res.reason).toBe("WALLET_DISCONNECTED");
		});

		it("rejects when connected wallet is not the designated resolver", () => {
			const randomUser =
				"GCRANDOM777777777777777777777777777777777777777777777777";
			const res = checkResolverAuth(randomUser, mockDispute);
			expect(res.isAuthorized).toBe(false);
			expect(res.reason).toBe("NOT_DESIGNATED_RESOLVER");
		});

		it("rejects when dispute is already resolved", () => {
			const resolvedDispute: DisputeRecord = {
				...mockDispute,
				status: "RESOLVED",
			};
			const res = checkResolverAuth(MOCK_RESOLVER, resolvedDispute);
			expect(res.isAuthorized).toBe(false);
			expect(res.reason).toBe("ALREADY_RESOLVED");
		});

		it("authorizes when connected wallet matches designated resolver", () => {
			const res = checkResolverAuth(MOCK_RESOLVER, mockDispute);
			expect(res.isAuthorized).toBe(true);
			expect(res.reason).toBeUndefined();
		});

		it("handles case-insensitive comparison safely", () => {
			const res = checkResolverAuth(MOCK_RESOLVER.toLowerCase(), mockDispute);
			expect(res.isAuthorized).toBe(true);
		});
	});

	describe("validateReleaseResolutionInput", () => {
		const validInput: ReleaseResolutionInput = {
			disputeId: "disp_9981",
			resolverWallet: MOCK_RESOLVER,
			winnerWallet: MOCK_WINNER,
			reasoning:
				"Confirmed judge inactivity past deadline. Verified prior evaluation scoring 98/100 and authorized prize release.",
		};

		it("passes on valid inputs", () => {
			const res = validateReleaseResolutionInput(validInput, mockDispute);
			expect(res.isValid).toBe(true);
			expect(Object.keys(res.errors)).toHaveLength(0);
		});

		it("fails if resolver is unauthorized", () => {
			const invalidInput = {
				...validInput,
				resolverWallet:
					"GCBADRESOLVER7777777777777777777777777777777777777777777",
			};
			const res = validateReleaseResolutionInput(invalidInput, mockDispute);
			expect(res.isValid).toBe(false);
			expect(res.errors.auth).toBe("NOT_DESIGNATED_RESOLVER");
		});

		it("fails if winner wallet is missing or invalid", () => {
			const invalidInput1 = { ...validInput, winnerWallet: "" };
			const res1 = validateReleaseResolutionInput(invalidInput1, mockDispute);
			expect(res1.isValid).toBe(false);
			expect(res1.errors.winnerWallet).toBeDefined();

			const invalidInput2 = {
				...validInput,
				winnerWallet: "invalid_stellar_key",
			};
			const res2 = validateReleaseResolutionInput(invalidInput2, mockDispute);
			expect(res2.isValid).toBe(false);
			expect(res2.errors.winnerWallet).toContain("56-character");
		});

		it("enforces reasoning length between 15 and 2000 characters", () => {
			const tooShort = { ...validInput, reasoning: "Too brief" };
			const resShort = validateReleaseResolutionInput(tooShort, mockDispute);
			expect(resShort.isValid).toBe(false);
			expect(resShort.errors.reasoning).toContain("at least 15 characters");

			const tooLong = { ...validInput, reasoning: "A".repeat(2001) };
			const resLong = validateReleaseResolutionInput(tooLong, mockDispute);
			expect(resLong.isValid).toBe(false);
			expect(resLong.errors.reasoning).toContain(
				"cannot exceed 2000 characters",
			);
		});
	});

	describe("createResolutionRecord", () => {
		it("creates a well-formed resolution record with RELEASE_TO_WINNER outcome", () => {
			const input: ReleaseResolutionInput = {
				disputeId: "disp_9981",
				resolverWallet: MOCK_RESOLVER,
				winnerWallet: MOCK_WINNER,
				reasoning: "Approved based on recorded score after judge timeout.",
			};
			const txHash =
				"f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8";

			const record = createResolutionRecord(input, mockDispute, txHash);

			expect(record.disputeId).toBe("disp_9981");
			expect(record.milestoneId).toBe("m1_first_place");
			expect(record.outcome).toBe("RELEASE_TO_WINNER");
			expect(record.winnerWallet).toBe(MOCK_WINNER);
			expect(record.amountUsdc).toBe("5,000");
			expect(record.resolverWallet).toBe(MOCK_RESOLVER);
			expect(record.txHash).toBe(txHash);
			expect(record.resolvedAt).toBeDefined();
			expect(new Date(record.resolvedAt).getTime()).not.toBeNaN();
		});
	});
});
