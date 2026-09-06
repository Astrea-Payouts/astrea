import { describe, expect, it } from "vitest";
import {
	checkDepositRequirement,
	getTransactionStepsInfo,
	isActionInFlight,
} from "@/lib/event-wizard/review-helpers";
import { StepReviewSign } from "../step-review-sign";

describe("StepReviewSign Component Contract", () => {
	it("exports StepReviewSign component", () => {
		expect(StepReviewSign).toBeDefined();
		expect(typeof StepReviewSign).toBe("function");
	});

	it("correctly identifies 2-step deposit flow when balance is below prize total", () => {
		const depositCheck = checkDepositRequirement(5000, 3000, "USDC");
		expect(depositCheck.needsDeposit).toBe(true);
		expect(depositCheck.requiredDeposit).toBe(2000);

		const stepConfig = getTransactionStepsInfo("IDLE", true);
		expect(stepConfig.totalSteps).toBe(2);
		expect(stepConfig.currentStepIndex).toBe(1);
		expect(stepConfig.actionTitle).toContain("Deposit Required USDC");
	});

	it("correctly identifies 1-step direct escrow flow when balance is sufficient", () => {
		const depositCheck = checkDepositRequirement(5000, 7500, "USDC");
		expect(depositCheck.needsDeposit).toBe(false);
		expect(depositCheck.requiredDeposit).toBe(0);

		const stepConfig = getTransactionStepsInfo("IDLE", false);
		expect(stepConfig.totalSteps).toBe(1);
		expect(stepConfig.currentStepIndex).toBe(1);
		expect(stepConfig.actionTitle).toBe("Sign create_event");
	});

	it("upholds non-optimistic in-flight states until ledger finality", () => {
		expect(isActionInFlight("PENDING_DEPOSIT")).toBe(true);
		expect(isActionInFlight("PENDING_CREATE_EVENT")).toBe(true);
		expect(isActionInFlight("IDLE")).toBe(false);
		expect(isActionInFlight("ERROR")).toBe(false);
	});
});
