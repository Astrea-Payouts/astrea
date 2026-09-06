import { describe, expect, it } from "vitest";
import { resolveDisputeReleaseAction } from "@/app/[locale]/events/[id]/dispute/review/actions";
import { MOCK_DISPUTE_RECORD } from "@/lib/dispute/events";

describe("Resolver Review Server Action & State Progression (T01c)", () => {
	const validResolver = MOCK_DISPUTE_RECORD.resolverAddress;
	const validWinner =
		MOCK_DISPUTE_RECORD.priorJudgeWinner?.wallet ||
		"GAWINNER222222222222222222222222222222222222222222222222";

	it("rejects resolution submission when resolver wallet is missing", async () => {
		const res = await resolveDisputeReleaseAction({
			disputeId: MOCK_DISPUTE_RECORD.id,
			resolverWallet: "",
			winnerWallet: validWinner,
			reasoning:
				"Legitimate adjudication rationale verifying prior evaluation.",
		});

		expect(res.success).toBe(false);
		expect(res.error).toBeDefined();
		expect(res.fieldErrors?.auth).toBe("WALLET_DISCONNECTED");
	});

	it("rejects resolution submission when caller is not the designated resolver", async () => {
		const unauthorizedWallet =
			"GCRANDOM777777777777777777777777777777777777777777777777";
		const res = await resolveDisputeReleaseAction({
			disputeId: MOCK_DISPUTE_RECORD.id,
			resolverWallet: unauthorizedWallet,
			winnerWallet: validWinner,
			reasoning:
				"Legitimate adjudication rationale verifying prior evaluation.",
		});

		expect(res.success).toBe(false);
		expect(res.fieldErrors?.auth).toBe("NOT_DESIGNATED_RESOLVER");
	});

	it("rejects resolution submission when winner wallet is invalid", async () => {
		const res = await resolveDisputeReleaseAction({
			disputeId: MOCK_DISPUTE_RECORD.id,
			resolverWallet: validResolver,
			winnerWallet: "invalid_stellar_address",
			reasoning:
				"Legitimate adjudication rationale verifying prior evaluation.",
		});

		expect(res.success).toBe(false);
		expect(res.fieldErrors?.winnerWallet).toBeDefined();
	});

	it("rejects resolution submission when rationale is too short", async () => {
		const res = await resolveDisputeReleaseAction({
			disputeId: MOCK_DISPUTE_RECORD.id,
			resolverWallet: validResolver,
			winnerWallet: validWinner,
			reasoning: "Short note",
		});

		expect(res.success).toBe(false);
		expect(res.fieldErrors?.reasoning).toBeDefined();
	});

	it("successfully signs resolution and produces confirmed transaction record on valid input", async () => {
		const res = await resolveDisputeReleaseAction({
			disputeId: MOCK_DISPUTE_RECORD.id,
			resolverWallet: validResolver,
			winnerWallet: validWinner,
			reasoning:
				"Confirmed judge inactivity past judging deadline. Validated prior evaluation score 98/100 and authorized prize release.",
		});

		expect(res.success).toBe(true);
		expect(res.record).toBeDefined();
		expect(res.record?.outcome).toBe("RELEASE_TO_WINNER");
		expect(res.record?.disputeId).toBe(MOCK_DISPUTE_RECORD.id);
		expect(res.record?.milestoneId).toBe(MOCK_DISPUTE_RECORD.milestoneId);
		expect(res.record?.amountUsdc).toBe(MOCK_DISPUTE_RECORD.amountUsdc);
		expect(res.record?.winnerWallet).toBe(validWinner);
		expect(res.record?.resolverWallet).toBe(validResolver);

		// Must provide realistic 64-character hex transaction hash
		expect(res.record?.txHash).toMatch(/^[0-9a-f]{64}$/);
		expect(res.record?.resolvedAt).toBeDefined();
	});
});
