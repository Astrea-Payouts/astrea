import { describe, expect, it } from "vitest";
import { cancelPreLiveEventAction } from "@/app/[locale]/events/[id]/cancel/actions";

describe("Cancel Event Server Action & State Guard (T02)", () => {
	const organizer = "GDORGANIZER1111111111111111111111111111111111111111111111";

	it("successfully executes pre-LIVE cancellation and refunds full balance to AdminWallet", async () => {
		const res = await cancelPreLiveEventAction({
			eventId: "evt_pre_live_hackathon",
			organizerWallet: organizer,
			cancellationReason: "Pre-launch budget reallocation.",
		});

		expect(res.success).toBe(true);
		expect(res.record).toBeDefined();
		expect(res.record?.outcome).toBe("REFUNDED_TO_ADMIN_WALLET");
		expect(res.record?.refundAmountUsdc).toBe(5000);
		expect(res.record?.adminWalletAddress).toBe(
			"GADMINWALLET22222222222222222222222222222222222222222222",
		);
		expect(res.record?.txHash).toMatch(/^[0-9a-f]{64}$/);
		expect(res.record?.cancelledAt).toBeDefined();
	});

	it("strictly rejects pre-LIVE direct refund if event is already LIVE", async () => {
		const res = await cancelPreLiveEventAction({
			eventId: "evt_active_live_event",
			organizerWallet: organizer,
			cancellationReason: "Attempting direct refund on live event.",
		});

		expect(res.success).toBe(false);
		expect(res.error).toContain("already LIVE");
	});

	it("rejects cancellation when caller is not the event organizer", async () => {
		const unauthorizedWallet =
			"GCRANDOM777777777777777777777777777777777777777777777777";
		const res = await cancelPreLiveEventAction({
			eventId: "evt_pre_live_hackathon",
			organizerWallet: unauthorizedWallet,
		});

		expect(res.success).toBe(false);
		expect(res.error).toBe("NOT_ORGANIZER");
	});
});
