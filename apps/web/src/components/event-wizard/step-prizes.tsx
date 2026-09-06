"use client";

import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Coins,
	HelpCircle,
	Plus,
	Sparkles,
	Trash2,
	Trophy,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	addPrizeRow,
	calculatePrizeSummary,
	createEmptyPrize,
	MAX_PRIZE_ROWS_CEILING,
	removePrizeRow,
	updatePrizeRow,
	validatePrizes,
} from "@/lib/prizes/prize-helpers";
import type { PrizeRow, PrizesStepData } from "@/lib/prizes/types";
import { cn } from "@/lib/utils";

export interface StepPrizesProps {
	initialPrizes?: PrizeRow[];
	adminWalletBalance?: number;
	currency?: string;
	onBack?: () => void;
	onNext?: (data: PrizesStepData) => void;
	readOnly?: boolean;
}

export function StepPrizes({
	initialPrizes,
	adminWalletBalance = 5000,
	currency = "USDC",
	onBack,
	onNext,
	readOnly = false,
}: StepPrizesProps) {
	const [prizes, setPrizes] = useState<PrizeRow[]>(() => {
		if (initialPrizes && initialPrizes.length > 0) {
			return initialPrizes;
		}
		return [
			createEmptyPrize("prize_1", "1st Place", 2500),
			createEmptyPrize("prize_2", "2nd Place", 1500),
			createEmptyPrize("prize_3", "3rd Place", 1000),
		];
	});

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

	const summary = useMemo(
		() => calculatePrizeSummary(prizes, adminWalletBalance),
		[prizes, adminWalletBalance],
	);

	const handleAddRow = () => {
		if (prizes.length >= MAX_PRIZE_ROWS_CEILING || readOnly) return;
		const updated = addPrizeRow(prizes);
		setPrizes(updated);
		if (hasAttemptedSubmit) {
			const validation = validatePrizes(updated, adminWalletBalance);
			setErrors(validation.errors);
		}
	};

	const handleRemoveRow = (id: string) => {
		if (prizes.length <= 1 || readOnly) return;
		const updated = removePrizeRow(prizes, id);
		setPrizes(updated);
		if (hasAttemptedSubmit) {
			const validation = validatePrizes(updated, adminWalletBalance);
			setErrors(validation.errors);
		}
	};

	const handleUpdateLabel = (id: string, label: string) => {
		if (readOnly) return;
		const updated = updatePrizeRow(prizes, id, { label });
		setPrizes(updated);
		if (hasAttemptedSubmit) {
			const validation = validatePrizes(updated, adminWalletBalance);
			setErrors(validation.errors);
		}
	};

	const handleUpdateAmount = (id: string, value: string) => {
		if (readOnly) return;
		const parsed = Number.parseFloat(value);
		const amount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
		const updated = updatePrizeRow(prizes, id, { amount });
		setPrizes(updated);
		if (hasAttemptedSubmit) {
			const validation = validatePrizes(updated, adminWalletBalance);
			setErrors(validation.errors);
		}
	};

	const applyPreset = (presetType: "top3" | "top5" | "equal" | "single") => {
		if (readOnly) return;
		const budget =
			summary.totalAmount > 0 ? summary.totalAmount : adminWalletBalance;
		let nextPrizes: PrizeRow[] = [];

		switch (presetType) {
			case "single":
				nextPrizes = [createEmptyPrize(undefined, "Grand Prize", budget)];
				break;
			case "top3":
				nextPrizes = [
					createEmptyPrize(undefined, "1st Place", Math.round(budget * 0.5)),
					createEmptyPrize(undefined, "2nd Place", Math.round(budget * 0.3)),
					createEmptyPrize(undefined, "3rd Place", Math.round(budget * 0.2)),
				];
				break;
			case "top5":
				nextPrizes = [
					createEmptyPrize(undefined, "1st Place", Math.round(budget * 0.4)),
					createEmptyPrize(undefined, "2nd Place", Math.round(budget * 0.25)),
					createEmptyPrize(undefined, "3rd Place", Math.round(budget * 0.15)),
					createEmptyPrize(undefined, "4th Place", Math.round(budget * 0.1)),
					createEmptyPrize(undefined, "5th Place", Math.round(budget * 0.1)),
				];
				break;
			case "equal": {
				const split = Math.floor(budget / 3);
				const remainder = budget - split * 3;
				nextPrizes = [
					createEmptyPrize(undefined, "1st Place", split + remainder),
					createEmptyPrize(undefined, "2nd Place", split),
					createEmptyPrize(undefined, "3rd Place", split),
				];
				break;
			}
		}

		setPrizes(nextPrizes);
		if (hasAttemptedSubmit) {
			const validation = validatePrizes(nextPrizes, adminWalletBalance);
			setErrors(validation.errors);
		}
	};

	const handleProceed = (e: React.FormEvent) => {
		e.preventDefault();
		setHasAttemptedSubmit(true);
		const validation = validatePrizes(prizes, adminWalletBalance);
		setErrors(validation.errors);

		if (validation.isValid && onNext) {
			onNext({
				prizes,
				currency,
				adminWalletBalance,
			});
		}
	};

	return (
		<div className="space-y-6">
			{/* Step Header */}
			<div className="space-y-1">
				<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
					<Trophy className="size-3.5" />
					<span>Step 2 of 5: Prize Allocation</span>
				</div>
				<h2 className="text-2xl font-bold tracking-tight text-foreground">
					Configure Prizes & Payouts
				</h2>
				<p className="text-sm text-muted-foreground">
					Define the distribution of awards. Both ranked awards and category
					tracks are settled through atomic smart contract escrows.
				</p>
			</div>

			{/* Balance & Real-time Budget Calculator */}
			<div className="rounded-xl border border-border bg-card p-5 shadow-xs">
				<div className="grid gap-4 sm:grid-cols-3">
					<div className="space-y-1">
						<span className="text-xs font-medium text-muted-foreground">
							Admin Wallet Free Balance
						</span>
						<div className="flex items-center gap-1.5 font-mono text-xl font-bold text-foreground">
							<Coins className="size-5 text-amber-500" />
							<span>{adminWalletBalance.toLocaleString()}</span>
							<span className="text-xs font-normal text-muted-foreground">
								{currency}
							</span>
						</div>
					</div>

					<div className="space-y-1">
						<span className="text-xs font-medium text-muted-foreground">
							Total Configured Prize Pool
						</span>
						<div className="flex items-center gap-1.5 font-mono text-xl font-bold text-foreground">
							<Trophy className="size-5 text-primary" />
							<span>{summary.totalAmount.toLocaleString()}</span>
							<span className="text-xs font-normal text-muted-foreground">
								{currency}
							</span>
						</div>
					</div>

					<div className="space-y-1">
						<span className="text-xs font-medium text-muted-foreground">
							Budget Status
						</span>
						<div>
							{summary.isOverBudget ? (
								<div className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
									<AlertCircle className="size-3.5" />
									<span>Exceeds Balance</span>
								</div>
							) : (
								<div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
									<CheckCircle2 className="size-3.5" />
									<span>Within Balance</span>
								</div>
							)}
							<div className="mt-1 font-mono text-xs text-muted-foreground">
								{summary.isOverBudget
									? `Deficit: -${summary.deficit.toLocaleString()} ${currency}`
									: `Remaining: +${summary.remainingBalance.toLocaleString()} ${currency}`}
							</div>
						</div>
					</div>
				</div>

				{/* Over-Budget Warning Banner */}
				{summary.isOverBudget && (
					<div
						data-testid="over-budget-warning"
						className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive"
					>
						<AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" />
						<div className="space-y-1">
							<p className="font-semibold">
								Prize Pool Exceeds Available Wallet Balance
							</p>
							<p className="text-xs leading-relaxed opacity-90">
								Your prize pool ({summary.totalAmount.toLocaleString()}{" "}
								{currency}) exceeds your free balance (
								{adminWalletBalance.toLocaleString()} {currency}) by{" "}
								<span className="font-bold underline">
									{summary.deficit.toLocaleString()} {currency}
								</span>
								. Please lower the prize amounts or fund your organizer wallet
								before publishing.
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Quick Presets Bar */}
			{!readOnly && (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-3">
					<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<Sparkles className="size-3.5 text-primary" />
						<span>Quick Presets:</span>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="xs"
							onClick={() => applyPreset("top3")}
							className="text-xs"
						>
							Top 3 (50 / 30 / 20)
						</Button>
						<Button
							type="button"
							variant="outline"
							size="xs"
							onClick={() => applyPreset("top5")}
							className="text-xs"
						>
							Top 5 (40 / 25 / 15 / 10 / 10)
						</Button>
						<Button
							type="button"
							variant="outline"
							size="xs"
							onClick={() => applyPreset("equal")}
							className="text-xs"
						>
							Equal Split (3 Ways)
						</Button>
						<Button
							type="button"
							variant="outline"
							size="xs"
							onClick={() => applyPreset("single")}
							className="text-xs"
						>
							Single Winner (100%)
						</Button>
					</div>
				</div>
			)}

			{/* Prize Rows Form */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-sm font-semibold text-foreground">
						Prizes & Category Tracks ({prizes.length} / {MAX_PRIZE_ROWS_CEILING}
						)
					</span>
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<HelpCircle className="size-3.5" />
						<span>Max 25 safe winners per Soroban transaction</span>
					</div>
				</div>

				{errors.general && (
					<p className="text-xs font-medium text-destructive">
						{errors.general}
					</p>
				)}
				{errors.budget && (
					<p className="text-xs font-medium text-destructive">
						{errors.budget}
					</p>
				)}

				<div className="space-y-2.5">
					{prizes.map((prize, idx) => {
						const labelError = errors[`${prize.id}_label`];
						const amountError = errors[`${prize.id}_amount`];

						return (
							<div
								key={prize.id}
								className={cn(
									"flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-colors sm:flex-row sm:items-center",
									(labelError || amountError) &&
										"border-destructive/60 bg-destructive/5",
								)}
							>
								{/* Number badge */}
								<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
									{idx + 1}
								</div>

								{/* Label Input */}
								<div className="flex-1 space-y-1">
									<input
										type="text"
										value={prize.label}
										disabled={readOnly}
										onChange={(e) =>
											handleUpdateLabel(prize.id, e.target.value)
										}
										placeholder="e.g., 1st Place, Best UX, Community Choice"
										aria-label={`Prize ${idx + 1} label`}
										className={cn(
											"w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50",
											labelError &&
												"border-destructive focus-visible:ring-destructive/20",
										)}
									/>
									{labelError && (
										<p className="text-[0.7rem] font-medium text-destructive">
											{labelError}
										</p>
									)}
								</div>

								{/* Amount Input */}
								<div className="w-full sm:w-44 space-y-1">
									<div className="relative">
										<input
											type="number"
											min="0"
											step="1"
											value={prize.amount === 0 ? "" : prize.amount}
											disabled={readOnly}
											onChange={(e) =>
												handleUpdateAmount(prize.id, e.target.value)
											}
											placeholder="0"
											aria-label={`Prize ${idx + 1} amount`}
											className={cn(
												"w-full rounded-md border border-input bg-background pr-12 pl-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50",
												amountError &&
													"border-destructive focus-visible:ring-destructive/20",
											)}
										/>
										<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
											{currency}
										</span>
									</div>
									{amountError && (
										<p className="text-[0.7rem] font-medium text-destructive">
											{amountError}
										</p>
									)}
								</div>

								{/* Delete Action */}
								{!readOnly && (
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => handleRemoveRow(prize.id)}
										disabled={prizes.length <= 1}
										aria-label={`Remove prize ${idx + 1}`}
										className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									>
										<Trash2 className="size-4" />
									</Button>
								)}
							</div>
						);
					})}
				</div>

				{/* Add Row Button */}
				{!readOnly && (
					<div className="pt-1">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleAddRow}
							disabled={prizes.length >= MAX_PRIZE_ROWS_CEILING}
							className="w-full sm:w-auto text-xs"
						>
							<Plus className="size-3.5" />
							<span>Add Prize Row</span>
						</Button>
					</div>
				)}
			</div>

			{/* Navigation Footer */}
			<div className="flex items-center justify-between border-t border-border pt-4">
				{onBack ? (
					<Button
						type="button"
						variant="outline"
						onClick={onBack}
						className="gap-2"
					>
						<ArrowLeft className="size-4" />
						<span>Back</span>
					</Button>
				) : (
					<div />
				)}

				{onNext && (
					<Button type="button" onClick={handleProceed} className="gap-2">
						<span>Continue to Judges</span>
						<ArrowRight className="size-4" />
					</Button>
				)}
			</div>
		</div>
	);
}
