import { describe, expect, it } from "vitest";
import { resolveCancelDistributionAction } from "@/app/[locale]/events/[id]/dispute/cancel/actions";
import { MOCK_CANCEL_DISPUTE } from "@/lib/dispute/events";

describe("Cancel Distribution Action & ADR-006 Protection (T01d)", () => {
	const validResolver = MOCK_CANCEL_DISPUTE.resolverAddress;

	it("rejects distribution submission when resolver wallet is missing", async () => {
		const res = await resolveCancelDistributionAction({
			disputeId: MOCK_CANCEL_DISPUTE.id,
			resolverWallet: "",
			participantPercentage: 50,
			organizerPercentage: 50,
			reasoning:
				"Detailed reasoning for 50/50 fund distribution between parties.",
		});

		expect(res.success).toBe(false);
		expect(res.fieldErrors?.auth).toBe("WALLET_DISCONNECTED");
	});

	it("rejects distribution submission when caller is not the designated resolver", async () => {
		const unauthorizedWallet =
			"GCRANDOM777777777777777777777777777777777777777777777777";
		const res = await resolveCancelDistributionAction({
			disputeId: MOCK_CANCEL_DISPUTE.id,
			resolverWallet: unauthorizedWallet,
			participantPercentage: 50,
			organizerPercentage: 50,
			reasoning:
				"Detailed reasoning for 50/50 fund distribution between parties.",
		});

		expect(res.success).toBe(false);
		expect(res.fieldErrors?.auth).toBe("NOT_DESIGNATED_RESOLVER");
	});

	it("ADR-006: rejects 100% refund to organizer on active event without explicit confirmation", async () => {
		const res = await resolveCancelDistributionAction({
			disputeId: MOCK_CANCEL_DISPUTE.id,
			resolverWallet: validResolver,
			participantPercentage: 0,
			organizerPercentage: 100,
			reasoning:
				"Detailed reasoning attempting full refund without confirmation.",
			explicitFullRefundConfirmed: false,
		});

		expect(res.success).toBe(false);
		expect(res.fieldErrors?.adr006).toBeDefined();
		expect(res.fieldErrors?.adr006).toContain("ADR-006 Safety Enforcement");
	});

	it("rejects distribution submission when reasoning is too short", async () => {
		const res = await resolveCancelDistributionAction({
			disputeId: MOCK_CANCEL_DISPUTE.id,
			resolverWallet: validResolver,
			participantPercentage: 50,
			organizerPercentage: 50,
			reasoning: "Too brief",
		});

		expect(res.success).toBe(false);
		expect(res.fieldErrors?.reasoning).toBeDefined();
	});

	it("successfully executes distribution on valid input and records confirmed on-chain hash", async () => {
		const res = await resolveCancelDistributionAction({
			disputeId: MOCK_CANCEL_DISPUTE.id,
			resolverWallet: validResolver,
			participantPercentage: 60,
			organizerPercentage: 40,
			reasoning:
				"Awarded 60% of escrow to participant pool to compensate labor invested in demo prototypes.",
		});

		expect(res.success).toBe(true);
		expect(res.record).toBeDefined();
		expect(res.record?.outcome).toBe("CANCEL_DISTRIBUTION");
		expect(res.record?.distribution.participantAmountUsdc).toBe(6000);
		expect(res.record?.distribution.organizerAmountUsdc).toBe(4000);
		expect(res.record?.distribution.participantPercentage).toBe(60);
		expect(res.record?.distribution.organizerPercentage).toBe(40);
		expect(res.record?.txHash).toMatch(/^[0-9a-f]{64}$/);
		expect(res.record?.resolvedAt).toBeDefined();
	});
});
