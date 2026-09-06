import { describe, expect, it } from "vitest";
import {
	createPreLiveCancelRecord,
	getCancellationPath,
	validatePreLiveCancel,
	verifyCancellationEligibility,
} from "./cancellation";
import type { CancellationContext, PreLiveCancelInput } from "./types";

const MOCK_ORGANIZER =
	"GDORGANIZER1111111111111111111111111111111111111111111111";
const MOCK_ADMIN_WALLET =
	"GADMINWALLET22222222222222222222222222222222222222222222";

const mockContext: CancellationContext = {
	eventId: "evt_buildathon_pre_live",
	eventTitle: "Stellar Global Buildathon",
	status: "FUNDED",
	totalEscrowUsdc: 5000,
	currency: "USDC",
	organizerAddress: MOCK_ORGANIZER,
	adminWalletAddress: MOCK_ADMIN_WALLET,
	registeredParticipantsCount: 0,
};

describe("Event Cancellation State Gating (T02 / ADR-006)", () => {
	describe("getCancellationPath", () => {
		it("routes CREATED and FUNDED to PRE_LIVE_REFUND", () => {
			expect(getCancellationPath("CREATED")).toBe("PRE_LIVE_REFUND");
			expect(getCancellationPath("FUNDED")).toBe("PRE_LIVE_REFUND");
		});

		it("routes LIVE and JUDGING to POST_LIVE_DISPUTE", () => {
			expect(getCancellationPath("LIVE")).toBe("POST_LIVE_DISPUTE");
			expect(getCancellationPath("JUDGING")).toBe("POST_LIVE_DISPUTE");
		});

		it("routes DRAFT, COMPLETED, and CANCELLED to INELIGIBLE", () => {
			expect(getCancellationPath("DRAFT")).toBe("INELIGIBLE");
			expect(getCancellationPath("COMPLETED")).toBe("INELIGIBLE");
			expect(getCancellationPath("CANCELLED")).toBe("INELIGIBLE");
		});
	});

	describe("verifyCancellationEligibility", () => {
		it("rejects disconnected wallet", () => {
			const res = verifyCancellationEligibility(null, mockContext);
			expect(res.isAuthorized).toBe(false);
			expect(res.reason).toBe("WALLET_DISCONNECTED");
		});

		it("rejects non-organizer wallet", () => {
			const randomUser =
				"GCRANDOM777777777777777777777777777777777777777777777777";
			const res = verifyCancellationEligibility(randomUser, mockContext);
			expect(res.isAuthorized).toBe(false);
			expect(res.reason).toBe("NOT_ORGANIZER");
		});

		it("authorizes organizer on FUNDED event for PRE_LIVE_REFUND", () => {
			const res = verifyCancellationEligibility(MOCK_ORGANIZER, mockContext);
			expect(res.isAuthorized).toBe(true);
			expect(res.path).toBe("PRE_LIVE_REFUND");
		});

		it("authorizes organizer on LIVE event for POST_LIVE_DISPUTE", () => {
			const liveContext: CancellationContext = {
				...mockContext,
				status: "LIVE",
				registeredParticipantsCount: 15,
			};
			const res = verifyCancellationEligibility(MOCK_ORGANIZER, liveContext);
			expect(res.isAuthorized).toBe(true);
			expect(res.path).toBe("POST_LIVE_DISPUTE");
		});
	});

	describe("validatePreLiveCancel", () => {
		const validInput: PreLiveCancelInput = {
			eventId: "evt_buildathon_pre_live",
			organizerWallet: MOCK_ORGANIZER,
			cancellationReason: "Change of plans before launch.",
		};

		it("passes on pre-LIVE funded event", () => {
			const res = validatePreLiveCancel(validInput, mockContext);
			expect(res.isValid).toBe(true);
		});

		it("rejects pre-LIVE cancel attempt if event has transitioned to LIVE", () => {
			const liveContext: CancellationContext = {
				...mockContext,
				status: "LIVE",
			};
			const res = validatePreLiveCancel(validInput, liveContext);
			expect(res.isValid).toBe(false);
			expect(res.error).toContain("already LIVE");
		});
	});

	describe("createPreLiveCancelRecord", () => {
		it("constructs confirmed refund record", () => {
			const input: PreLiveCancelInput = {
				eventId: "evt_buildathon_pre_live",
				organizerWallet: MOCK_ORGANIZER,
			};
			const txHash =
				"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
			const record = createPreLiveCancelRecord(input, mockContext, txHash);

			expect(record.eventId).toBe("evt_buildathon_pre_live");
			expect(record.outcome).toBe("REFUNDED_TO_ADMIN_WALLET");
			expect(record.refundAmountUsdc).toBe(5000);
			expect(record.adminWalletAddress).toBe(MOCK_ADMIN_WALLET);
			expect(record.txHash).toBe(txHash);
			expect(record.cancelledAt).toBeDefined();
		});
	});
});
