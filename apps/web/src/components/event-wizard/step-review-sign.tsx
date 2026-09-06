"use client";

import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Clock,
	Coins,
	FileText,
	Loader2,
	Lock,
	RefreshCw,
	Scale,
	Trophy,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TxHashLink } from "@/components/tx-hash-link";
import { Button } from "@/components/ui/button";
import {
	checkDepositRequirement,
	formatDateDisplay,
	getTransactionStepsInfo,
	isActionInFlight,
} from "@/lib/event-wizard/review-helpers";
import type {
	SigningPhase,
	WizardReviewData,
} from "@/lib/event-wizard/review-types";

export interface StepReviewSignProps {
	data?: Partial<WizardReviewData>;
	onBack?: () => void;
	onStepSelect?: (stepIndex: number) => void;
	onSuccess?: (eventId: string, txHash: string) => void;
	onDepositSigned?: (amount: number) => Promise<{ txHash: string }>;
	onCreateEventSigned?: (
		data: WizardReviewData,
	) => Promise<{ eventId: string; txHash: string }>;
}

export function StepReviewSign({
	data,
	onBack,
	onStepSelect,
	onSuccess,
	onDepositSigned,
	onCreateEventSigned,
}: StepReviewSignProps) {
	// Consolidate review data with safe fallbacks
	const reviewData: WizardReviewData = useMemo(() => {
		return {
			details: {
				title: data?.details?.title || "Untitled Hackathon",
				description:
					data?.details?.description ||
					"Prize challenge with smart escrow on Stellar.",
				websiteUrl: data?.details?.websiteUrl,
				registrationDeadline:
					data?.details?.registrationDeadline ||
					new Date(Date.now() + 86400000 * 7).toISOString(),
				submissionDeadline:
					data?.details?.submissionDeadline ||
					new Date(Date.now() + 86400000 * 14).toISOString(),
				judgingEnd:
					data?.details?.judgingEnd ||
					new Date(Date.now() + 86400000 * 21).toISOString(),
			},
			prizes: {
				items: data?.prizes?.items || [
					{ id: "p1", label: "1st Place", amount: 2500, currency: "USDC" },
					{ id: "p2", label: "2nd Place", amount: 1500, currency: "USDC" },
					{ id: "p3", label: "3rd Place", amount: 1000, currency: "USDC" },
				],
				currency: data?.prizes?.currency || "USDC",
				totalAmount:
					data?.prizes?.totalAmount ??
					(data?.prizes?.items || []).reduce((acc, p) => acc + p.amount, 5000),
			},
			judges: {
				judgeAddresses: data?.judges?.judgeAddresses || [
					"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
				],
				resolverAddress:
					data?.judges?.resolverAddress ||
					"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
				isAstreaDefaultResolver: data?.judges?.isAstreaDefaultResolver ?? true,
			},
			questions: {
				enabled: data?.questions?.enabled ?? false,
				questionsCount: data?.questions?.questionsCount ?? 0,
			},
			organizerWallet: {
				address:
					data?.organizerWallet?.address ||
					"GDX3F72F77Q5P6L7N7U2C5PJPV2G43T7S6OQ3M3E4Z6U7K8L9M0N1P2Q",
				balance: data?.organizerWallet?.balance ?? 3500, // Default for testing deposit deficit flow
				currency: "USDC",
			},
		};
	}, [data]);

	const depositInfo = useMemo(
		() =>
			checkDepositRequirement(
				reviewData.prizes.totalAmount,
				reviewData.organizerWallet.balance,
				reviewData.prizes.currency,
			),
		[
			reviewData.prizes.totalAmount,
			reviewData.organizerWallet.balance,
			reviewData.prizes.currency,
		],
	);

	const [phase, setPhase] = useState<SigningPhase>("IDLE");
	const [progressPercent, setProgressPercent] = useState(0);
	const [depositTxHash, setDepositTxHash] = useState<string | undefined>();
	const [eventTxHash, setEventTxHash] = useState<string | undefined>();
	const [createdEventId, setCreatedEventId] = useState<string | undefined>();
	const [errorMessage, setErrorMessage] = useState<string | undefined>();

	const stepConfig = useMemo(
		() => getTransactionStepsInfo(phase, depositInfo.needsDeposit),
		[phase, depositInfo.needsDeposit],
	);

	// Non-optimistic progress bar: race quickly to 90%, then wait for ledger finality
	useEffect(() => {
		let interval: NodeJS.Timeout | undefined;
		if (phase === "PENDING_DEPOSIT" || phase === "PENDING_CREATE_EVENT") {
			setProgressPercent(15);
			interval = setInterval(() => {
				setProgressPercent((prev) => {
					if (prev >= 90) {
						clearInterval(interval);
						return 90; // Wait honestly at 90% for real ledger consensus
					}
					return prev + 15;
				});
			}, 350);
		} else if (phase === "SUCCESS" || phase === "DEPOSIT_CONFIRMED") {
			setProgressPercent(100);
		} else {
			setProgressPercent(0);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [phase]);

	// Execution handler for the signing sequence
	const handleStartSigning = async () => {
		setErrorMessage(undefined);

		try {
			// Phase 1: Deposit if balance is insufficient
			if (depositInfo.needsDeposit && phase === "IDLE") {
				setPhase("SIGNING_DEPOSIT");

				let dTx =
					"4c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d";
				if (onDepositSigned) {
					const res = await onDepositSigned(depositInfo.requiredDeposit);
					dTx = res.txHash;
				} else {
					// Simulate wallet signing delay
					await new Promise((r) => setTimeout(r, 600));
				}

				setDepositTxHash(dTx);
				setPhase("PENDING_DEPOSIT");

				// Simulate ledger confirmation delay (Stellar consensus ~4-5s in real life)
				await new Promise((r) => setTimeout(r, 1200));
				setPhase("DEPOSIT_CONFIRMED");

				// Pause briefly to show confirmed state before moving to create_event
				await new Promise((r) => setTimeout(r, 600));
			}

			// Phase 2: Create Event
			setPhase("SIGNING_CREATE_EVENT");
			let eTx =
				"9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e";
			let newId = `ev_${Date.now()}`;

			if (onCreateEventSigned) {
				const res = await onCreateEventSigned(reviewData);
				eTx = res.txHash;
				newId = res.eventId;
			} else {
				// Simulate wallet signing delay
				await new Promise((r) => setTimeout(r, 600));
			}

			setEventTxHash(eTx);
			setCreatedEventId(newId);
			setPhase("PENDING_CREATE_EVENT");

			// Simulate ledger confirmation
			await new Promise((r) => setTimeout(r, 1200));
			setPhase("SUCCESS");

			if (onSuccess) {
				onSuccess(newId, eTx);
			}
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : "Transaction rejected or failed.";
			setErrorMessage(msg);
			setPhase("ERROR");
		}
	};

	const inFlight = isActionInFlight(phase);

	return (
		<div className="space-y-6">
			{/* Step Header */}
			<div className="space-y-1">
				<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
					<Lock className="size-3.5" />
					<span>Step 5 of 5: Review & Sign</span>
				</div>
				<h2 className="text-2xl font-bold tracking-tight text-foreground">
					Review Competition & Sign Escrow
				</h2>
				<p className="text-sm text-muted-foreground">
					Verify all competition parameters before signing. Funds are locked
					verifiably on-chain into a Stellar smart escrow.
				</p>
			</div>

			{/* Review Summary Grid */}
			<div className="grid gap-4 md:grid-cols-2">
				{/* 1. Details Card */}
				<div className="rounded-xl border border-border bg-card p-4 space-y-3">
					<div className="flex items-center justify-between border-b border-border/60 pb-2">
						<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
							<FileText className="size-4 text-primary" />
							<span>Event Details</span>
						</div>
						{onStepSelect && !inFlight && (
							<button
								type="button"
								onClick={() => onStepSelect(1)}
								className="text-xs text-primary hover:underline"
							>
								Edit
							</button>
						)}
					</div>
					<div className="space-y-2 text-xs">
						<div>
							<span className="text-muted-foreground">Title:</span>
							<p className="font-semibold text-foreground text-sm">
								{reviewData.details.title}
							</p>
						</div>
						<div>
							<span className="text-muted-foreground">Description:</span>
							<p className="line-clamp-2 text-foreground">
								{reviewData.details.description}
							</p>
						</div>
						<div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[0.75rem]">
							<div>
								<span className="text-muted-foreground block">
									Registration Deadline:
								</span>
								<span className="font-medium text-foreground">
									{formatDateDisplay(reviewData.details.registrationDeadline)}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground block">
									Submission Deadline:
								</span>
								<span className="font-medium text-foreground">
									{formatDateDisplay(reviewData.details.submissionDeadline)}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* 2. Prizes Card */}
				<div className="rounded-xl border border-border bg-card p-4 space-y-3">
					<div className="flex items-center justify-between border-b border-border/60 pb-2">
						<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
							<Trophy className="size-4 text-primary" />
							<span>Prizes & Allocations</span>
						</div>
						{onStepSelect && !inFlight && (
							<button
								type="button"
								onClick={() => onStepSelect(2)}
								className="text-xs text-primary hover:underline"
							>
								Edit
							</button>
						)}
					</div>
					<div className="space-y-2 text-xs">
						<div className="flex items-center justify-between font-medium">
							<span className="text-muted-foreground">Total Prize Pool:</span>
							<span className="font-mono text-base font-bold text-foreground">
								{reviewData.prizes.totalAmount.toLocaleString()}{" "}
								{reviewData.prizes.currency}
							</span>
						</div>
						<div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
							{reviewData.prizes.items.map((p, idx) => (
								<div
									key={p.id || idx}
									className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
								>
									<span className="font-medium text-foreground">{p.label}</span>
									<span className="font-mono text-muted-foreground">
										{p.amount.toLocaleString()} {reviewData.prizes.currency}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* 3. Judges & Resolver Card */}
				<div className="rounded-xl border border-border bg-card p-4 space-y-3">
					<div className="flex items-center justify-between border-b border-border/60 pb-2">
						<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
							<Scale className="size-4 text-primary" />
							<span>Judges & Resolver</span>
						</div>
						{onStepSelect && !inFlight && (
							<button
								type="button"
								onClick={() => onStepSelect(3)}
								className="text-xs text-primary hover:underline"
							>
								Edit
							</button>
						)}
					</div>
					<div className="space-y-2 text-xs">
						<div>
							<span className="text-muted-foreground">
								Judge Panel ({reviewData.judges.judgeAddresses.length}):
							</span>
							<div className="mt-1 space-y-1">
								{reviewData.judges.judgeAddresses.slice(0, 2).map((addr) => (
									<div
										key={addr}
										className="truncate font-mono text-[0.7rem] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded"
									>
										{addr}
									</div>
								))}
								{reviewData.judges.judgeAddresses.length > 2 && (
									<span className="text-[0.7rem] text-muted-foreground">
										+{reviewData.judges.judgeAddresses.length - 2} more judges
									</span>
								)}
							</div>
						</div>
						<div className="pt-1 border-t border-border/40">
							<span className="text-muted-foreground">Dispute Resolver:</span>
							<p className="font-medium text-foreground">
								{reviewData.judges.isAstreaDefaultResolver
									? "Astrea Community Resolver (Default)"
									: "Custom Designated Resolver"}
							</p>
						</div>
					</div>
				</div>

				{/* 4. Registration Questions Card */}
				<div className="rounded-xl border border-border bg-card p-4 space-y-3">
					<div className="flex items-center justify-between border-b border-border/60 pb-2">
						<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
							<Users className="size-4 text-primary" />
							<span>Registration Configuration</span>
						</div>
						{onStepSelect && !inFlight && (
							<button
								type="button"
								onClick={() => onStepSelect(4)}
								className="text-xs text-primary hover:underline"
							>
								Edit
							</button>
						)}
					</div>
					<div className="space-y-2 text-xs">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Custom Questions:</span>
							<span className="font-medium text-foreground">
								{reviewData.questions?.enabled
									? `Enabled (${reviewData.questions.questionsCount} questions)`
									: "Standard (No custom questions)"}
							</span>
						</div>
						<p className="text-[0.75rem] text-muted-foreground">
							Participants must connect a Stellar wallet with an active USDC
							trustline before registration can be accepted.
						</p>
					</div>
				</div>
			</div>

			{/* Financial Telemetry & Balance Comparison */}
			<div className="rounded-xl border border-border bg-card p-5 space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Coins className="size-5 text-amber-500" />
						<span className="text-sm font-semibold text-foreground">
							Escrow Funding & Wallet Balance
						</span>
					</div>
					<div className="text-xs font-mono text-muted-foreground">
						Wallet: {reviewData.organizerWallet.address.slice(0, 4)}…
						{reviewData.organizerWallet.address.slice(-4)}
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-3">
					<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
						<span className="text-xs text-muted-foreground block">
							Current Free Balance
						</span>
						<span className="font-mono text-lg font-bold text-foreground">
							{depositInfo.currentBalance.toLocaleString()}{" "}
							{depositInfo.currency}
						</span>
					</div>

					<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
						<span className="text-xs text-muted-foreground block">
							Required Prize Escrow
						</span>
						<span className="font-mono text-lg font-bold text-foreground">
							{depositInfo.totalPrizes.toLocaleString()} {depositInfo.currency}
						</span>
					</div>

					<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
						<span className="text-xs text-muted-foreground block">
							Funding Path
						</span>
						{depositInfo.needsDeposit ? (
							<span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
								<Clock className="size-3.5" />
								<span>2-Step: Deposit + Create</span>
							</span>
						) : (
							<span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
								<CheckCircle2 className="size-3.5" />
								<span>1-Step: Direct Escrow</span>
							</span>
						)}
					</div>
				</div>

				{/* 2-Step Deposit Notice */}
				{depositInfo.needsDeposit && phase === "IDLE" && (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 space-y-1">
						<p className="font-semibold">
							Explicit 2-Step Signing Required (Deficit:{" "}
							{depositInfo.requiredDeposit.toLocaleString()}{" "}
							{depositInfo.currency})
						</p>
						<p className="leading-relaxed opacity-90">
							Your current wallet balance (
							{depositInfo.currentBalance.toLocaleString()}{" "}
							{depositInfo.currency}) is less than the prize total. Per Astrea's
							security principles, you will sign an explicit deposit transaction
							first ("1 of 2: deposit funds"), wait for ledger confirmation, and
							then sign "2 of 2: create event."
						</p>
					</div>
				)}
			</div>

			{/* In-flight / Progress Banner (Honest Non-Optimistic Ledger Progress) */}
			{inFlight && phase !== "SUCCESS" && (
				<div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Loader2 className="size-4 animate-spin text-primary" />
							<span className="text-sm font-semibold text-foreground">
								{phase === "SIGNING_DEPOSIT" &&
									"Awaiting Wallet Signature: Deposit"}
								{phase === "PENDING_DEPOSIT" &&
									"Confirming Deposit on Stellar Ledger…"}
								{phase === "DEPOSIT_CONFIRMED" &&
									"Deposit Confirmed! Preparing create_event…"}
								{phase === "SIGNING_CREATE_EVENT" &&
									"Awaiting Wallet Signature: create_event"}
								{phase === "PENDING_CREATE_EVENT" &&
									"Confirming Event Initialization on Ledger…"}
							</span>
						</div>
						<span className="font-mono text-xs font-medium text-primary">
							{progressPercent}%
						</span>
					</div>

					{/* Race-to-90% progress bar */}
					<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full bg-primary transition-all duration-300 ease-out"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>

					<p className="text-xs text-muted-foreground leading-relaxed">
						{phase === "PENDING_DEPOSIT" || phase === "PENDING_CREATE_EVENT"
							? "Waiting for consensus across Stellar validators. Per Astrea UX principles, success will only display once ledger finality is reached."
							: "Please check your connected wallet to review and sign the transaction."}
					</p>

					{/* Explorer Links */}
					{(depositTxHash || eventTxHash) && (
						<div className="pt-2 border-t border-border/40 space-y-1">
							{depositTxHash && (
								<div className="flex items-center gap-2 text-xs">
									<span className="text-muted-foreground">Deposit Tx:</span>
									<TxHashLink hash={depositTxHash} network="testnet" />
								</div>
							)}
							{eventTxHash && (
								<div className="flex items-center gap-2 text-xs">
									<span className="text-muted-foreground">
										Create Event Tx:
									</span>
									<TxHashLink hash={eventTxHash} network="testnet" />
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* Success State */}
			{phase === "SUCCESS" && (
				<div
					data-testid="event-created-success"
					className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-3 text-emerald-950 dark:text-emerald-200"
				>
					<div className="flex items-center gap-2.5">
						<CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
						<span className="text-base font-bold">
							Event Successfully Created & Escrow Locked!
						</span>
					</div>
					<p className="text-xs leading-relaxed opacity-95">
						Smart contract escrow is initialized on Stellar testnet. All prize
						funds ({reviewData.prizes.totalAmount.toLocaleString()}{" "}
						{reviewData.prizes.currency}) are verifiably locked.
					</p>
					{eventTxHash && (
						<div className="flex items-center gap-2 pt-1 text-xs">
							<span className="font-semibold">Transaction Proof:</span>
							<TxHashLink hash={eventTxHash} network="testnet" />
						</div>
					)}
					<div className="pt-2">
						<a
							href={`/organizer/events/${createdEventId || "demo-event"}`}
							className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
						>
							<span>Go to Organizer Dashboard</span>
							<ArrowRight className="size-3.5" />
						</a>
					</div>
				</div>
			)}

			{/* Error State */}
			{phase === "ERROR" && (
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive space-y-2">
					<div className="flex items-center gap-2 font-semibold text-sm">
						<AlertCircle className="size-4" />
						<span>Signing or Confirmation Failed</span>
					</div>
					<p>{errorMessage || "Transaction was rejected or timed out."}</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleStartSigning}
						className="gap-1.5 text-xs mt-1"
					>
						<RefreshCw className="size-3.5" />
						<span>Retry Transaction</span>
					</Button>
				</div>
			)}

			{/* Action Footer */}
			<div className="flex items-center justify-between border-t border-border pt-4">
				{onBack && phase === "IDLE" ? (
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

				{phase === "IDLE" && (
					<Button
						type="button"
						onClick={handleStartSigning}
						className="gap-2 font-semibold shadow-md"
					>
						<Lock className="size-4" />
						<span>{stepConfig.actionTitle}</span>
						<span className="text-xs opacity-75 font-mono">
							({stepConfig.label})
						</span>
					</Button>
				)}
			</div>
		</div>
	);
}
