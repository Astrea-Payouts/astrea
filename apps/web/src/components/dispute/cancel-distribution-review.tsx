"use client";

import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	Coins,
	Gavel,
	Loader2,
	Lock,
	Scale,
	ShieldAlert,
	ShieldCheck,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { resolveCancelDistributionAction } from "@/app/[locale]/events/[id]/dispute/cancel/actions";
import { TxHashLink } from "@/components/tx-hash-link";
import {
	calculateDistribution,
	checkResolverAuth,
} from "@/lib/dispute/cancel-distribution";
import type {
	CancelDisputeRecord,
	CancelDistributionRecord,
} from "@/lib/dispute/types";
import { useWallet } from "@/lib/wallet/provider";

interface CancelDistributionReviewProps {
	dispute: CancelDisputeRecord;
	locale: string;
}

type StepState = "idle" | "submitting" | "confirming" | "confirmed";

export function CancelDistributionReview({
	dispute,
	locale,
}: CancelDistributionReviewProps) {
	const t = useTranslations("CancelDistribution");
	const { address: userWallet, connect } = useWallet();

	const isResolved =
		dispute.status === "RESOLVED" || Boolean(dispute.resolution);
	const authCheck = checkResolverAuth(userWallet, dispute);
	const isAuthorized = authCheck.isAuthorized;

	// By default per ADR-006, distribution NEVER defaults to 100% organizer refund.
	// Initial split starts at a balanced 50/50.
	const [participantPct, setParticipantPct] = useState(50);
	const [explicitFullRefundConfirmed, setExplicitFullRefundConfirmed] =
		useState(false);
	const [reasoning, setReasoning] = useState(
		"Adjudicated 50/50 distribution. 5,000 USDC allocated to participant pool to compensate labor invested prior to cancel request.",
	);
	const [acceptedTerms, setAcceptedTerms] = useState(false);

	const [stepState, setStepState] = useState<StepState>(
		isResolved ? "confirmed" : "idle",
	);
	const [resolutionRecord, setResolutionRecord] =
		useState<CancelDistributionRecord | null>(dispute.resolution || null);
	const [formError, setFormError] = useState<string | null>(null);

	const organizerPct = 100 - participantPct;
	const distribution = calculateDistribution(
		dispute.totalEscrowUsdc,
		participantPct,
		organizerPct,
	);
	const isFullRefund = organizerPct === 100;
	const isPending = stepState === "submitting" || stepState === "confirming";

	const handleParticipantSlider = (val: number) => {
		setParticipantPct(val);
		if (val > 0) {
			setExplicitFullRefundConfirmed(false);
		}
	};

	const handleSubmitDistribution = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);

		if (!userWallet) {
			setFormError(t("walletRequired"));
			return;
		}

		if (!isAuthorized) {
			setFormError(t("unauthorizedError"));
			return;
		}

		if (
			isFullRefund &&
			dispute.registeredParticipantsCount > 0 &&
			!explicitFullRefundConfirmed
		) {
			setFormError(t("adr006RequiredError"));
			return;
		}

		if (reasoning.trim().length < 15) {
			setFormError(t("reasoningTooShort"));
			return;
		}

		if (!acceptedTerms) {
			setFormError(t("termsRequired"));
			return;
		}

		try {
			setStepState("submitting");

			setTimeout(() => {
				setStepState("confirming");
			}, 600);

			const result = await resolveCancelDistributionAction({
				disputeId: dispute.id,
				resolverWallet: userWallet,
				participantPercentage: participantPct,
				organizerPercentage: organizerPct,
				reasoning: reasoning.trim(),
				explicitFullRefundConfirmed,
			});

			if (!result.success || !result.record) {
				setStepState("idle");
				setFormError(result.error || t("genericSubmitError"));
				return;
			}

			setResolutionRecord(result.record);
			setStepState("confirmed");
		} catch (err) {
			console.error("Cancel distribution resolution failed:", err);
			setStepState("idle");
			setFormError(t("genericSubmitError"));
		}
	};

	return (
		<div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
			{/* Header section */}
			<div className="border-b border-border/40 pb-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							<Scale className="h-4 w-4 text-primary" />
							<span>{t("badge")}</span>
							<span>•</span>
							<span className="font-mono">{dispute.id}</span>
						</div>
						<h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
							{t("pageTitle")}
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("pageSubtitle", { eventTitle: dispute.eventTitle })}
						</p>
					</div>

					{/* Resolver status pill */}
					<div className="flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1.5 text-xs">
						<Gavel className="h-3.5 w-3.5 text-primary" />
						<span className="text-muted-foreground">{t("resolverPill")}:</span>
						<span className="font-mono text-foreground">
							{dispute.resolverAddress.slice(0, 6)}...
							{dispute.resolverAddress.slice(-4)}
						</span>
					</div>
				</div>
			</div>

			{/* Wallet connection / auth banner */}
			{!userWallet ? (
				<div className="rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-6">
					<div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
						<div className="space-y-1">
							<h2 className="text-base font-semibold text-foreground">
								{t("connectWalletTitle")}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t("connectWalletDesc")}
							</p>
						</div>
						<button
							type="button"
							onClick={() => connect()}
							className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
						>
							{t("connectWalletAction")}
						</button>
					</div>
				</div>
			) : !isAuthorized && !isResolved ? (
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 sm:p-6">
					<div className="flex items-start gap-3">
						<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
						<div className="space-y-1">
							<h2 className="text-base font-semibold text-destructive">
								{t("unauthorizedTitle")}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t("unauthorizedDesc", {
									connected: `${userWallet.slice(0, 6)}...${userWallet.slice(-4)}`,
									expected: `${dispute.resolverAddress.slice(0, 6)}...${dispute.resolverAddress.slice(-4)}`,
								})}
							</p>
						</div>
					</div>
				</div>
			) : (
				<div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-primary sm:text-sm">
					<ShieldCheck className="h-4 w-4 shrink-0" />
					<span>
						{t("authorizedBanner", {
							address: `${userWallet.slice(0, 6)}...${userWallet.slice(-4)}`,
						})}
					</span>
				</div>
			)}

			{/* Event & cancellation context */}
			<div className="grid gap-6 md:grid-cols-2">
				<div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
					<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						{t("eventContextHeading")}
					</h2>

					<div className="space-y-3 text-sm">
						<div className="flex justify-between border-b border-border/40 pb-2">
							<span className="text-muted-foreground">
								{t("totalEscrowLabel")}:
							</span>
							<span className="font-bold text-primary">
								{dispute.totalEscrowUsdc.toLocaleString()} {dispute.currency}
							</span>
						</div>
						<div className="flex justify-between border-b border-border/40 pb-2">
							<span className="text-muted-foreground">
								{t("participantsLabel")}:
							</span>
							<span className="inline-flex items-center gap-1 font-semibold text-foreground">
								<Users className="h-3.5 w-3.5 text-primary" />
								{dispute.registeredParticipantsCount} registered
							</span>
						</div>
						<div className="flex justify-between border-b border-border/40 pb-2">
							<span className="text-muted-foreground">
								{t("organizerLabel")}:
							</span>
							<span className="font-mono text-xs text-foreground">
								{dispute.organizerAddress.slice(0, 6)}...
								{dispute.organizerAddress.slice(-4)}
							</span>
						</div>
					</div>

					<div className="pt-2">
						<span className="text-xs font-medium text-muted-foreground">
							{t("cancellationReasonLabel")}:
						</span>
						<p className="mt-1 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
							"{dispute.cancellationReason}"
						</p>
					</div>
				</div>

				{/* ADR-006 Safety Dossier */}
				<div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
					<div className="flex items-center gap-2">
						<ShieldAlert className="h-4 w-4 text-primary" />
						<h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
							{t("adr006Title")}
						</h2>
					</div>
					<p className="text-xs text-muted-foreground leading-relaxed">
						{t("adr006Explanation")}
					</p>
					<div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
						<span className="font-semibold text-foreground">
							{t("bindingMandateLabel")}:
						</span>{" "}
						{t("bindingMandateDesc")}
					</div>
				</div>
			</div>

			{/* Distribution Form or Confirmed Receipt */}
			{stepState === "confirmed" && resolutionRecord ? (
				<div className="rounded-2xl border border-primary/40 bg-card p-6 sm:p-8 shadow-md space-y-6">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
							<CheckCircle2 className="h-6 w-6" />
						</div>
						<div>
							<h2 className="text-xl font-bold text-foreground">
								{t("confirmedTitle")}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t("confirmedSubtitle")}
							</p>
						</div>
					</div>

					<div className="grid gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-sm sm:grid-cols-2">
						<div>
							<span className="text-xs text-muted-foreground">
								{t("participantSplitLabel")}:
							</span>
							<div className="mt-1 font-bold text-primary">
								{resolutionRecord.distribution.participantAmountUsdc.toLocaleString()}{" "}
								USDC ({resolutionRecord.distribution.participantPercentage}%)
							</div>
						</div>
						<div>
							<span className="text-xs text-muted-foreground">
								{t("organizerRefundLabel")}:
							</span>
							<div className="mt-1 font-bold text-foreground">
								{resolutionRecord.distribution.organizerAmountUsdc.toLocaleString()}{" "}
								USDC ({resolutionRecord.distribution.organizerPercentage}%)
							</div>
						</div>
						<div className="sm:col-span-2">
							<span className="text-xs text-muted-foreground">
								{t("txHashLabel")}:
							</span>
							<div className="mt-1">
								<TxHashLink hash={resolutionRecord.txHash} />
							</div>
						</div>
						<div className="sm:col-span-2">
							<span className="text-xs text-muted-foreground">
								{t("reasoningLabel")}:
							</span>
							<p className="mt-1 rounded bg-muted/60 p-2.5 text-xs text-foreground leading-relaxed">
								{resolutionRecord.reasoning}
							</p>
						</div>
					</div>

					<div className="flex justify-end pt-2">
						<Link
							href={`/${locale}/events/${dispute.eventId}`}
							className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
						>
							<span>{t("returnToEventAction")}</span>
							<ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</div>
			) : (
				<form
					onSubmit={handleSubmitDistribution}
					className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-6"
				>
					<div>
						<h2 className="text-lg font-bold text-foreground">
							{t("decideDistributionTitle")}
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{t("decideDistributionSubtitle")}
						</p>
					</div>

					{/* Form error alert */}
					{formError && (
						<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 shrink-0" />
							<span>{formError}</span>
						</div>
					)}

					{/* Interactive Split Allocator */}
					<div className="rounded-xl border border-border/80 bg-muted/20 p-5 space-y-5">
						<div className="flex justify-between items-center text-sm font-semibold text-foreground">
							<span className="flex items-center gap-1.5 text-primary">
								<Users className="h-4 w-4" />
								{t("participantsPoolLabel")}:{" "}
								{distribution.participantAmountUsdc.toLocaleString()} USDC (
								{participantPct}%)
							</span>
							<span className="flex items-center gap-1.5 text-muted-foreground">
								<Coins className="h-4 w-4" />
								{t("organizerRefundShortLabel")}:{" "}
								{distribution.organizerAmountUsdc.toLocaleString()} USDC (
								{organizerPct}%)
							</span>
						</div>

						{/* Split Bar Visualization */}
						<div className="h-4 w-full overflow-hidden rounded-full bg-muted flex border border-border/40">
							<div
								style={{ width: `${participantPct}%` }}
								className="bg-primary transition-all duration-200"
							/>
							<div
								style={{ width: `${organizerPct}%` }}
								className="bg-muted-foreground/40 transition-all duration-200"
							/>
						</div>

						{/* Slider Control */}
						<div>
							<label htmlFor="participantSlider" className="sr-only">
								Participant distribution percentage
							</label>
							<input
								id="participantSlider"
								type="range"
								min={0}
								max={100}
								step={5}
								value={participantPct}
								onChange={(e) =>
									handleParticipantSlider(Number(e.target.value))
								}
								disabled={isPending || !isAuthorized}
								className="w-full accent-primary cursor-pointer"
							/>
							<div className="flex justify-between text-[11px] text-muted-foreground mt-1 font-mono">
								<span>0% (Full refund risk)</span>
								<span>50% (Balanced)</span>
								<span>100% (Full participant pool)</span>
							</div>
						</div>
					</div>

					{/* ADR-006 Red Warning on 100% Organizer Refund Attempt */}
					{isFullRefund && dispute.registeredParticipantsCount > 0 && (
						<div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 space-y-3">
							<div className="flex items-start gap-2.5">
								<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
								<div>
									<h3 className="text-xs font-bold uppercase tracking-wider text-destructive">
										{t("adr006OverrideHeader")}
									</h3>
									<p className="mt-1 text-xs text-muted-foreground leading-relaxed">
										{t("adr006OverrideWarning")}
									</p>
								</div>
							</div>

							<label className="flex items-start gap-2.5 pt-1 cursor-pointer">
								<input
									type="checkbox"
									checked={explicitFullRefundConfirmed}
									onChange={(e) =>
										setExplicitFullRefundConfirmed(e.target.checked)
									}
									disabled={isPending || !isAuthorized}
									className="mt-0.5 h-4 w-4 rounded border-destructive text-destructive focus:ring-destructive"
								/>
								<span className="text-xs font-medium text-destructive leading-relaxed">
									{t("adr006ExplicitConfirmationCheckbox")}
								</span>
							</label>
						</div>
					)}

					{/* Reasoning Textarea */}
					<div>
						<div className="flex items-center justify-between">
							<label
								htmlFor="reasoning"
								className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
							>
								{t("adjudicationRationaleLabel")}
							</label>
							<span className="text-[11px] text-muted-foreground font-mono">
								{reasoning.length}/2000 {t("charsUnit")}
							</span>
						</div>
						<p className="mt-0.5 text-xs text-muted-foreground">
							{t("adjudicationRationaleHelp")}
						</p>
						<textarea
							id="reasoning"
							rows={4}
							value={reasoning}
							onChange={(e) => setReasoning(e.target.value)}
							disabled={isPending || !isAuthorized}
							placeholder={t("adjudicationRationalePlaceholder")}
							className="mt-2 block w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 leading-relaxed"
						/>
					</div>

					{/* Good-faith acknowledgment */}
					<div className="rounded-lg border border-border/80 bg-muted/20 p-3.5">
						<label className="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={acceptedTerms}
								onChange={(e) => setAcceptedTerms(e.target.checked)}
								disabled={isPending || !isAuthorized}
								className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
							/>
							<span className="text-xs text-muted-foreground leading-relaxed">
								{t("termsDeclaration")}
							</span>
						</label>
					</div>

					{/* Submit button */}
					<div className="flex flex-col items-end gap-3 pt-2 sm:flex-row sm:justify-between sm:items-center">
						<div className="text-xs text-muted-foreground flex items-center gap-1.5">
							<Lock className="h-3.5 w-3.5 text-muted-foreground" />
							<span>{t("honestStateNotice")}</span>
						</div>

						<button
							type="submit"
							disabled={
								isPending ||
								!isAuthorized ||
								!acceptedTerms ||
								(isFullRefund &&
									dispute.registeredParticipantsCount > 0 &&
									!explicitFullRefundConfirmed)
							}
							className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isPending ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									<span>
										{stepState === "submitting"
											? t("submittingState")
											: t("confirmingState")}
									</span>
								</>
							) : (
								<>
									<Gavel className="h-4 w-4" />
									<span>{t("executeDistributionAction")}</span>
								</>
							)}
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
