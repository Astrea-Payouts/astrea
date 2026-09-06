import { describe, expect, it } from "vitest";
import {
	addPrizeRow,
	calculatePrizeSummary,
	createEmptyPrize,
	getPresetPrizes,
	MAX_PRIZE_ROWS_CEILING,
	removePrizeRow,
	updatePrizeRow,
	validatePrizes,
} from "../prize-helpers";
import type { PrizeRow } from "../types";

describe("prizes helpers", () => {
	it("createEmptyPrize initializes valid prize row", () => {
		const prize = createEmptyPrize("test_1", "Grand Prize", 1000);
		expect(prize.id).toBe("test_1");
		expect(prize.label).toBe("Grand Prize");
		expect(prize.amount).toBe(1000);
		expect(prize.currency).toBe("USDC");
	});

	it("calculatePrizeSummary computes total, remaining balance, and deficit correctly", () => {
		const prizes: PrizeRow[] = [
			{ id: "1", label: "1st", amount: 500 },
			{ id: "2", label: "2nd", amount: 300 },
		];

		const summaryWithin = calculatePrizeSummary(prizes, 1000);
		expect(summaryWithin.totalAmount).toBe(800);
		expect(summaryWithin.isOverBudget).toBe(false);
		expect(summaryWithin.deficit).toBe(0);
		expect(summaryWithin.remainingBalance).toBe(200);

		const summaryOver = calculatePrizeSummary(prizes, 700);
		expect(summaryOver.totalAmount).toBe(800);
		expect(summaryOver.isOverBudget).toBe(true);
		expect(summaryOver.deficit).toBe(100);
		expect(summaryOver.remainingBalance).toBe(0);
	});

	it("validatePrizes checks empty prize array", () => {
		const res = validatePrizes([], 1000);
		expect(res.isValid).toBe(false);
		expect(res.errors.general).toBeDefined();
	});

	it("validatePrizes checks missing label and non-positive amount", () => {
		const prizes: PrizeRow[] = [
			{ id: "p1", label: "", amount: 100 },
			{ id: "p2", label: "2nd", amount: 0 },
		];

		const res = validatePrizes(prizes, 1000);
		expect(res.isValid).toBe(false);
		expect(res.errors.p1_label).toBeDefined();
		expect(res.errors.p2_amount).toBeDefined();
	});

	it("validatePrizes checks over-budget condition against admin balance", () => {
		const prizes: PrizeRow[] = [{ id: "p1", label: "1st", amount: 2000 }];

		const res = validatePrizes(prizes, 1500);
		expect(res.isValid).toBe(false);
		expect(res.errors.budget).toContain("exceeds available free balance");
	});

	it("addPrizeRow generates ordinal labels and enforces MAX_PRIZE_ROWS_CEILING", () => {
		let list: PrizeRow[] = [];
		list = addPrizeRow(list);
		expect(list[0].label).toBe("1st Place");

		list = addPrizeRow(list);
		expect(list[1].label).toBe("2nd Place");

		list = addPrizeRow(list);
		expect(list[2].label).toBe("3rd Place");

		list = addPrizeRow(list);
		expect(list[3].label).toBe("4th Place");

		// Fill up to ceiling
		for (let i = list.length; i < MAX_PRIZE_ROWS_CEILING; i++) {
			list = addPrizeRow(list);
		}
		expect(list.length).toBe(MAX_PRIZE_ROWS_CEILING);

		// Exceeding ceiling returns same array
		const overCeiling = addPrizeRow(list);
		expect(overCeiling.length).toBe(MAX_PRIZE_ROWS_CEILING);
	});

	it("removePrizeRow and updatePrizeRow modify prizes correctly", () => {
		const initial: PrizeRow[] = [
			{ id: "p1", label: "1st Place", amount: 1000 },
			{ id: "p2", label: "2nd Place", amount: 500 },
		];

		const updated = updatePrizeRow(initial, "p2", { amount: 600 });
		expect(updated.find((p) => p.id === "p2")?.amount).toBe(600);

		const removed = removePrizeRow(updated, "p1");
		expect(removed.length).toBe(1);
		expect(removed[0].id).toBe("p2");
	});

	it("getPresetPrizes divides standard percentages", () => {
		const preset = getPresetPrizes(10000);
		expect(preset.length).toBe(3);
		expect(preset[0].amount).toBe(5000);
		expect(preset[1].amount).toBe(3000);
		expect(preset[2].amount).toBe(2000);
	});
});
