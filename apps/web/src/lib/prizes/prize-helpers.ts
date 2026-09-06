import type { PrizeRow, PrizeSummary, PrizeValidationResult } from "./types";

export const MAX_PRIZE_ROWS_CEILING = 25; // K06 validated ceiling for safe Soroban winner calls

export function createEmptyPrize(
	customId?: string,
	label?: string,
	amount = 0,
): PrizeRow {
	const id =
		customId ||
		`prize_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	return {
		id,
		label: label || "",
		amount,
		currency: "USDC",
	};
}

export function calculatePrizeSummary(
	prizes: PrizeRow[],
	adminWalletBalance: number,
): PrizeSummary {
	const totalAmount = prizes.reduce((sum, p) => {
		const amt =
			typeof p.amount === "number" && !Number.isNaN(p.amount) ? p.amount : 0;
		return sum + Math.max(0, amt);
	}, 0);

	const isOverBudget = totalAmount > adminWalletBalance;
	const deficit = isOverBudget ? totalAmount - adminWalletBalance : 0;
	const remainingBalance = isOverBudget
		? 0
		: Math.max(0, adminWalletBalance - totalAmount);

	return {
		totalAmount,
		adminWalletBalance,
		isOverBudget,
		deficit,
		remainingBalance,
		rowCount: prizes.length,
	};
}

export function validatePrizes(
	prizes: PrizeRow[],
	adminWalletBalance: number,
): PrizeValidationResult {
	const errors: Record<string, string> = {};

	if (!prizes || prizes.length === 0) {
		errors.general = "At least one prize must be configured.";
		return { isValid: false, errors };
	}

	for (const p of prizes) {
		if (!p.label || p.label.trim() === "") {
			errors[`${p.id}_label`] = "Prize label is required.";
		}
		if (
			typeof p.amount !== "number" ||
			Number.isNaN(p.amount) ||
			p.amount <= 0
		) {
			errors[`${p.id}_amount`] = "Prize amount must be greater than 0.";
		}
	}

	const summary = calculatePrizeSummary(prizes, adminWalletBalance);
	if (summary.isOverBudget) {
		errors.budget = `Total prize pool (${summary.totalAmount.toLocaleString()} USDC) exceeds available free balance (${adminWalletBalance.toLocaleString()} USDC) by ${summary.deficit.toLocaleString()} USDC.`;
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
}

export function addPrizeRow(
	prizes: PrizeRow[],
	maxLimit = MAX_PRIZE_ROWS_CEILING,
): PrizeRow[] {
	if (prizes.length >= maxLimit) {
		return prizes;
	}

	const nextIndex = prizes.length + 1;
	let defaultLabel = `${nextIndex}th Place`;
	if (nextIndex === 1) defaultLabel = "1st Place";
	else if (nextIndex === 2) defaultLabel = "2nd Place";
	else if (nextIndex === 3) defaultLabel = "3rd Place";

	return [...prizes, createEmptyPrize(undefined, defaultLabel, 0)];
}

export function removePrizeRow(prizes: PrizeRow[], id: string): PrizeRow[] {
	return prizes.filter((p) => p.id !== id);
}

export function updatePrizeRow(
	prizes: PrizeRow[],
	id: string,
	patch: Partial<PrizeRow>,
): PrizeRow[] {
	return prizes.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

export function getPresetPrizes(totalBudget = 5000): PrizeRow[] {
	return [
		createEmptyPrize(undefined, "1st Place", Math.round(totalBudget * 0.5)),
		createEmptyPrize(undefined, "2nd Place", Math.round(totalBudget * 0.3)),
		createEmptyPrize(undefined, "3rd Place", Math.round(totalBudget * 0.2)),
	];
}
