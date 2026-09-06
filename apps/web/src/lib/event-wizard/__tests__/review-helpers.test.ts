import { describe, expect, it } from "vitest";
import {
	checkDepositRequirement,
	formatDateDisplay,
	getTransactionStepsInfo,
	isActionInFlight,
	validateReviewData,
} from "../review-helpers";
import type { WizardReviewData } from "../review-types";

describe("review-helpers", () => {
	it("checkDepositRequirement detects sufficient balance", () => {
		const res = checkDepositRequirement(3000, 5000);
		expect(res.needsDeposit).toBe(false);
		expect(res.requiredDeposit).toBe(0);
		expect(res.currentBalance).toBe(5000);
		expect(res.totalPrizes).toBe(3000);
	});

	it("checkDepositRequirement detects deficit and computes required deposit", () => {
		const res = checkDepositRequirement(6000, 2500);
		expect(res.needsDeposit).toBe(true);
		expect(res.requiredDeposit).toBe(3500);
		expect(res.currentBalance).toBe(2500);
		expect(res.totalPrizes).toBe(6000);
	});

	it("getTransactionStepsInfo handles 2-step flow when deposit is required", () => {
		const step1 = getTransactionStepsInfo("IDLE", true);
		expect(step1.totalSteps).toBe(2);
		expect(step1.currentStepIndex).toBe(1);
		expect(step1.label).toContain("Step 1 of 2: Deposit Funds");

		const step1Signing = getTransactionStepsInfo("SIGNING_DEPOSIT", true);
		expect(step1Signing.currentStepIndex).toBe(1);

		const step2 = getTransactionStepsInfo("SIGNING_CREATE_EVENT", true);
		expect(step2.totalSteps).toBe(2);
		expect(step2.currentStepIndex).toBe(2);
		expect(step2.label).toContain("Step 2 of 2: Initialize Escrow");
	});

	it("getTransactionStepsInfo handles 1-step flow when balance is sufficient", () => {
		const step = getTransactionStepsInfo("IDLE", false);
		expect(step.totalSteps).toBe(1);
		expect(step.currentStepIndex).toBe(1);
		expect(step.label).toContain("Step 1 of 1: Initialize Escrow");
	});

	it("isActionInFlight identifies active and idle phases", () => {
		expect(isActionInFlight("IDLE")).toBe(false);
		expect(isActionInFlight("ERROR")).toBe(false);
		expect(isActionInFlight("SIGNING_DEPOSIT")).toBe(true);
		expect(isActionInFlight("PENDING_DEPOSIT")).toBe(true);
		expect(isActionInFlight("SIGNING_CREATE_EVENT")).toBe(true);
		expect(isActionInFlight("PENDING_CREATE_EVENT")).toBe(true);
	});

	it("validateReviewData detects missing fields and approves complete data", () => {
		const emptyCheck = validateReviewData({});
		expect(emptyCheck.isValid).toBe(false);
		expect(emptyCheck.missingSections.length).toBeGreaterThanOrEqual(3);

		const fullData: WizardReviewData = {
			details: {
				title: "Stellar Horizon Hackathon",
				description: "A builder competition",
				registrationDeadline: "2026-10-01T00:00:00Z",
				submissionDeadline: "2026-10-15T00:00:00Z",
				judgingEnd: "2026-10-20T00:00:00Z",
			},
			prizes: {
				items: [{ id: "1", label: "1st", amount: 5000 }],
				currency: "USDC",
				totalAmount: 5000,
			},
			judges: {
				judgeAddresses: [
					"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
				],
				resolverAddress:
					"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
				isAstreaDefaultResolver: true,
			},
			organizerWallet: {
				address: "GCXYZ",
				balance: 10000,
			},
		};

		const validCheck = validateReviewData(fullData);
		expect(validCheck.isValid).toBe(true);
		expect(validCheck.missingSections).toHaveLength(0);
	});

	it("formatDateDisplay formats dates nicely and handles fallbacks", () => {
		expect(formatDateDisplay(undefined)).toBe("Not specified");
		const formatted = formatDateDisplay("2026-12-25T00:00:00.000Z");
		expect(formatted).toContain("2026");
	});
});
