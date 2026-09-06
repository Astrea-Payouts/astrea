import { describe, expect, it } from "vitest";
import {
	calculatePrizeSummary,
	MAX_PRIZE_ROWS_CEILING,
	validatePrizes,
} from "@/lib/prizes/prize-helpers";
import type { PrizeRow } from "@/lib/prizes/types";
import { StepPrizes } from "../step-prizes";

describe("StepPrizes component contract and logic", () => {
	it("exports StepPrizes component", () => {
		expect(StepPrizes).toBeDefined();
		expect(typeof StepPrizes).toBe("function");
	});

	it("correctly identifies over-budget calculations for UI rendering", () => {
		const samplePrizes: PrizeRow[] = [
			{ id: "1", label: "1st Place", amount: 3000 },
			{ id: "2", label: "2nd Place", amount: 2000 },
			{ id: "3", label: "3rd Place", amount: 1500 },
		];

		const summary = calculatePrizeSummary(samplePrizes, 5000);
		expect(summary.totalAmount).toBe(6500);
		expect(summary.isOverBudget).toBe(true);
		expect(summary.deficit).toBe(1500);

		const validation = validatePrizes(samplePrizes, 5000);
		expect(validation.isValid).toBe(false);
		expect(validation.errors.budget).toBeDefined();
		expect(validation.errors.budget).toContain(
			"exceeds available free balance",
		);
	});

	it("validates within-budget distribution", () => {
		const samplePrizes: PrizeRow[] = [
			{ id: "1", label: "1st Place", amount: 2500 },
			{ id: "2", label: "2nd Place", amount: 1500 },
			{ id: "3", label: "3rd Place", amount: 1000 },
		];

		const summary = calculatePrizeSummary(samplePrizes, 5000);
		expect(summary.totalAmount).toBe(5000);
		expect(summary.isOverBudget).toBe(false);
		expect(summary.deficit).toBe(0);
		expect(summary.remainingBalance).toBe(0);

		const validation = validatePrizes(samplePrizes, 5000);
		expect(validation.isValid).toBe(true);
		expect(Object.keys(validation.errors)).toHaveLength(0);
	});

	it("respects MAX_PRIZE_ROWS_CEILING of 25", () => {
		expect(MAX_PRIZE_ROWS_CEILING).toBe(25);
	});
});
