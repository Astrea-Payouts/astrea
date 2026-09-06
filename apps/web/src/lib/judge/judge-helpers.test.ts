import { describe, expect, it } from "vitest";
import {
	calculateMultisigProgress,
	canAssignWinner,
	canSignApprove,
	canSignRelease,
	describeSigningStage,
} from "./judge-helpers";
import type { JudgePrize, JudgeSignerInfo } from "./types";

describe("Judge Panel Logic & Gating (U05)", () => {
	describe("Winner Assignment Gating", () => {
		it("permits winner assignment during JUDGING or LIVE phase", () => {
			expect(canAssignWinner("PENDING_REVIEW", "JUDGING")).toBe(true);
			expect(canAssignWinner("WINNER_ASSIGNED", "JUDGING")).toBe(true);
			expect(canAssignWinner("PENDING_REVIEW", "LIVE")).toBe(true);
		});

		it("prohibits winner assignment once approved, released, or disputed", () => {
			expect(canAssignWinner("APPROVED", "JUDGING")).toBe(false);
			expect(canAssignWinner("RELEASED", "JUDGING")).toBe(false);
			expect(canAssignWinner("DISPUTED", "JUDGING")).toBe(false);
			expect(canAssignWinner("PENDING_REVIEW", "COMPLETED")).toBe(false);
		});
	});

	describe("Two-Step Signing Sequence Gating (ADR-003, ADR-004)", () => {
		const mockWinner =
			"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

		it("blocks approve if winner is not assigned", () => {
			const prize: Pick<
				JudgePrize,
				"status" | "assignedWinnerWallet" | "winnerTrustlineVerified"
			> = {
				status: "PENDING_REVIEW",
				assignedWinnerWallet: undefined,
				winnerTrustlineVerified: false,
			};
			expect(canSignApprove(prize)).toBe(false);
		});

		it("blocks approve if winner trustline is missing (ADR-004)", () => {
			const prize: Pick<
				JudgePrize,
				"status" | "assignedWinnerWallet" | "winnerTrustlineVerified"
			> = {
				status: "WINNER_ASSIGNED",
				assignedWinnerWallet: mockWinner,
				winnerTrustlineVerified: false,
			};
			expect(canSignApprove(prize)).toBe(false);
		});

		it("enables approve once winner assigned and trustline verified", () => {
			const prize: Pick<
				JudgePrize,
				"status" | "assignedWinnerWallet" | "winnerTrustlineVerified"
			> = {
				status: "WINNER_ASSIGNED",
				assignedWinnerWallet: mockWinner,
				winnerTrustlineVerified: true,
			};
			expect(canSignApprove(prize)).toBe(true);
		});

		it("blocks release before approve has confirmed on-chain", () => {
			const prize: Pick<JudgePrize, "status" | "assignedWinnerWallet"> = {
				status: "WINNER_ASSIGNED",
				assignedWinnerWallet: mockWinner,
			};
			expect(canSignRelease(prize)).toBe(false);
		});

		it("enables release only after approve has confirmed", () => {
			const prize: Pick<JudgePrize, "status" | "assignedWinnerWallet"> = {
				status: "APPROVED",
				assignedWinnerWallet: mockWinner,
			};
			expect(canSignRelease(prize)).toBe(true);
		});
	});

	describe("Multisig Threshold Calculation (ADR-003)", () => {
		it("correctly evaluates single-signer judge", () => {
			const singleSigner: JudgeSignerInfo = {
				address: "GBBD47...",
				isMultisig: false,
				totalSigners: 1,
				requiredSignatures: 1,
				collectedSignatures: 1,
			};
			const res = calculateMultisigProgress(singleSigner);
			expect(res.isThresholdMet).toBe(true);
			expect(res.remainingSignatures).toBe(0);
			expect(res.progressPercent).toBe(100);
		});

		it("accurately reports pending signatures in a 2-of-3 multisig panel", () => {
			const multisigPartial: JudgeSignerInfo = {
				address: "GMULTISIG...",
				isMultisig: true,
				totalSigners: 3,
				requiredSignatures: 2,
				collectedSignatures: 1,
			};
			const res = calculateMultisigProgress(multisigPartial);
			expect(res.isThresholdMet).toBe(false);
			expect(res.remainingSignatures).toBe(1);
			expect(res.progressPercent).toBe(50);
			expect(res.displayString).toBe("1 of 2 signatures collected");
		});

		it("recognizes threshold met in multisig panel", () => {
			const multisigComplete: JudgeSignerInfo = {
				address: "GMULTISIG...",
				isMultisig: true,
				totalSigners: 3,
				requiredSignatures: 2,
				collectedSignatures: 2,
			};
			const res = calculateMultisigProgress(multisigComplete);
			expect(res.isThresholdMet).toBe(true);
			expect(res.remainingSignatures).toBe(0);
			expect(res.progressPercent).toBe(100);
			expect(res.displayString).toBe("2 of 2 signatures collected");
		});
	});

	describe("Signing Stage Descriptions", () => {
		it("provides honest descriptive states for ongoing and finished phases", () => {
			expect(describeSigningStage("APPROVE_BUILDING").isOngoing).toBe(true);
			expect(
				describeSigningStage("RELEASE_PENDING_CONFIRMATION").isOngoing,
			).toBe(true);
			expect(describeSigningStage("RELEASED").isFinished).toBe(true);
			expect(describeSigningStage("FAILED").isFailed).toBe(true);
		});
	});
});
