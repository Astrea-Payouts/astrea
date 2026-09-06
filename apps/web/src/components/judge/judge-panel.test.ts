import { describe, expect, it } from "vitest";
import {
	calculateMultisigProgress,
	canAssignWinner,
	canSignApprove,
	canSignRelease,
	describeSigningStage,
} from "@/lib/judge/judge-helpers";
import type { JudgePrize, JudgeSignerInfo } from "@/lib/judge/types";

describe("Judge Panel Component & Flow Tests (U05)", () => {
	const mockWinnerWallet =
		"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

	const basePrize: JudgePrize = {
		id: "prize-grand",
		title: "Grand Prize",
		amount: 10000,
		currency: "USDC",
		status: "PENDING_REVIEW",
		submissions: [
			{
				id: "sub-1",
				participantWallet: mockWinnerWallet,
				projectTitle: "DeFi Automated Vault",
				url: "https://github.com/astrea/vault",
				submittedAt: "2026-09-06T00:00:00Z",
				score: 95,
			},
		],
	};

	describe("Prize Review & Winner Assignment Rules", () => {
		it("allows assigning winner when in PENDING_REVIEW during JUDGING", () => {
			expect(canAssignWinner(basePrize.status, "JUDGING")).toBe(true);
		});

		it("allows re-assigning winner when in WINNER_ASSIGNED before approve is signed", () => {
			expect(canAssignWinner("WINNER_ASSIGNED", "JUDGING")).toBe(true);
		});

		it("locks winner assignment once prize has been APPROVED or RELEASED", () => {
			expect(canAssignWinner("APPROVED", "JUDGING")).toBe(false);
			expect(canAssignWinner("RELEASED", "JUDGING")).toBe(false);
		});
	});

	describe("Two-Step Payment Authorization (ADR-003, ADR-004)", () => {
		it("rejects Approve signing if trustline is unverified or false", () => {
			const assignedNoTrustline: JudgePrize = {
				...basePrize,
				status: "WINNER_ASSIGNED",
				assignedWinnerWallet: mockWinnerWallet,
				winnerTrustlineVerified: false,
			};
			expect(canSignApprove(assignedNoTrustline)).toBe(false);
		});

		it("permits Approve signing only when winner assigned AND trustline verified", () => {
			const readyForApprove: JudgePrize = {
				...basePrize,
				status: "WINNER_ASSIGNED",
				assignedWinnerWallet: mockWinnerWallet,
				winnerTrustlineVerified: true,
			};
			expect(canSignApprove(readyForApprove)).toBe(true);
		});

		it("strictly prohibits Release signing before Approve confirms on ledger", () => {
			const unapprovedPrize: JudgePrize = {
				...basePrize,
				status: "WINNER_ASSIGNED",
				assignedWinnerWallet: mockWinnerWallet,
				winnerTrustlineVerified: true,
			};
			expect(canSignRelease(unapprovedPrize)).toBe(false);
		});

		it("enables Release signing immediately after Approve confirms", () => {
			const approvedPrize: JudgePrize = {
				...basePrize,
				status: "APPROVED",
				assignedWinnerWallet: mockWinnerWallet,
				winnerTrustlineVerified: true,
			};
			expect(canSignRelease(approvedPrize)).toBe(true);
		});
	});

	describe("Stellar Multisig Judge Panel Coordination (ADR-003)", () => {
		it("accurately tracks 2-of-3 threshold progression", () => {
			const panel: JudgeSignerInfo = {
				address: "GMULTISIG777...",
				isMultisig: true,
				totalSigners: 3,
				requiredSignatures: 2,
				collectedSignatures: 0,
			};

			let progress = calculateMultisigProgress(panel);
			expect(progress.isThresholdMet).toBe(false);
			expect(progress.remainingSignatures).toBe(2);
			expect(progress.progressPercent).toBe(0);

			// First judge signs
			panel.collectedSignatures = 1;
			progress = calculateMultisigProgress(panel);
			expect(progress.isThresholdMet).toBe(false);
			expect(progress.remainingSignatures).toBe(1);
			expect(progress.progressPercent).toBe(50);
			expect(progress.displayString).toContain("1 of 2 signatures collected");

			// Second judge signs (threshold met!)
			panel.collectedSignatures = 2;
			progress = calculateMultisigProgress(panel);
			expect(progress.isThresholdMet).toBe(true);
			expect(progress.remainingSignatures).toBe(0);
			expect(progress.progressPercent).toBe(100);
			expect(progress.displayString).toContain("2 of 2 signatures collected");
		});

		it("handles single-judge signer accounts without multisig requirement", () => {
			const singleJudge: JudgeSignerInfo = {
				address: "GSINGLE777...",
				isMultisig: false,
				totalSigners: 1,
				requiredSignatures: 1,
				collectedSignatures: 1,
			};
			const progress = calculateMultisigProgress(singleJudge);
			expect(progress.isThresholdMet).toBe(true);
			expect(progress.displayString).toBe("Single Signature Verified");
		});
	});

	describe("Signing Stage Feedback & Progress Bar Semantics", () => {
		it("reports ongoing state for approve building and pending confirmation", () => {
			expect(describeSigningStage("APPROVE_BUILDING").isOngoing).toBe(true);
			expect(describeSigningStage("APPROVE_SIGNING").isOngoing).toBe(true);
			expect(
				describeSigningStage("APPROVE_PENDING_CONFIRMATION").isOngoing,
			).toBe(true);
		});

		it("reports ongoing state for release pipeline", () => {
			expect(describeSigningStage("RELEASE_BUILDING").isOngoing).toBe(true);
			expect(
				describeSigningStage("RELEASE_PENDING_CONFIRMATION").isOngoing,
			).toBe(true);
		});

		it("reports finished state only upon RELEASED confirmation", () => {
			expect(describeSigningStage("RELEASED").isFinished).toBe(true);
			expect(describeSigningStage("APPROVED").isFinished).toBe(false);
		});
	});
});
