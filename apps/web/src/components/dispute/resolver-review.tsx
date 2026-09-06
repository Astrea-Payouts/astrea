"use client";

import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	ExternalLink,
	Gavel,
	Loader2,
	Lock,
	Scale,
	ShieldCheck,
	UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { resolveDisputeReleaseAction } from "@/app/[locale]/events/[id]/dispute/review/actions";
import { TxHashLink } from "@/components/tx-hash-link";
import {
	checkResolverAuth,
	isValidStellarAddress,
} from "@/lib/dispute/resolution";
import type {
	DisputeRecord,
	DisputeResolutionRecord,
} from "@/lib/dispute/types";
import { useWallet } from "@/lib/wallet/provider";

interface ResolverReviewProps {
	dispute: DisputeRecord;
	locale: string;
}

type StepState = "idle" | "submitting" | "confirming" | "confirmed";

export function ResolverReview({ dispute, locale }: ResolverReviewProps) {
	const t = useTranslations("ResolverReview");
	const { address: userWallet, connect } = useWallet();

	const isResolved =
		dispute.status === "RESOLVED" || Boolean(dispute.resolution);
	const authCheck = checkResolverAuth(userWallet, dispute);
	const isAuthorized = authCheck.isAuthorized;

	const [winnerWallet, setWinnerWallet] = useState(
		dispute.priorJudgeWinner?.wallet || "",
	);
	const [reasoning, setReasoning] = useState(
		dispute.priorJudgeWinner
			? `Confirmed judge inactivity past deadline. Authorizing release to pre-recorded winner (${dispute.priorJudgeWinner.participantName || "finalist"}) based on evaluation score of ${dispute.priorJudgeWinner.notes || "top rank"}.`
			: "",
	);
	const [acceptedTerms, setAcceptedTerms] = useState(false);

	const [stepState, setStepState] = useState<StepState>(
		isResolved ? "confirmed" : "idle",
	);
	const [resolutionRecord, setResolutionRecord] =
		useState<DisputeResolutionRecord | null>(dispute.resolution || null);
	const [formError, setFormError] = useState<string | null>(null);

	const isPending = stepState === "submitting" || stepState === "confirming";

	const handleSubmitResolution = async (e: React.FormEvent) => {
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

		if (!isValidStellarAddress(winnerWallet)) {
			setFormError(t("invalidWinnerWallet"));
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

			// Transition to confirming state after building
			setTimeout(() => {
				setStepState("confirming");
			}, 600);

			const result = await resolveDisputeReleaseAction({
				disputeId: dispute.id,
				resolverWallet: userWallet,
				winnerWallet: winnerWallet.trim(),
				reasoning: reasoning.trim(),
			});

			if (!result.success || !result.record) {
				setStepState("idle");
				setFormError(result.error || t("genericSubmitError"));
				return;
			}

			setResolutionRecord(result.record);
			setStepState("confirmed");
		} catch (err) {
			console.error("Dispute resolution signing failed:", err);
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

			{/* Wallet connection / authorization check banner */}
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

			{/* Milestone context & evidence dossier */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Dispute context */}
				<div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
					<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						{t("contextHeading")}
					</h2>

					<div className="space-y-3 text-sm">
						<div className="flex justify-between border-b border-border/40 pb-2">
							<span className="text-muted-foreground">
								{t("milestoneLabel")}:
							</span>
							<span className="font-medium text-foreground">
								{dispute.milestoneTitle}
							</span>
						</div>
						<div className="flex justify-between border-b border-border/40 pb-2">
							<span className="text-muted-foreground">
								{t("escrowAmountLabel")}:
							</span>
							<span className="font-semibold text-primary">
								{dispute.amountUsdc} USDC
							</span>
						</div>
						<div className="flex justify-between border-b border-border/40 pb-2">
							<span className="text-muted-foreground">
								{t("deadlineLabel")}:
							</span>
							<span className="font-mono text-xs text-foreground">
								{new Date(dispute.judgingDeadline).toLocaleDateString()}
								{dispute.isJudgingDeadlinePassed && (
									<span className="ml-1.5 inline-flex rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
										{t("deadlineExpiredBadge")}
									</span>
								)}
							</span>
						</div>
						<div className="flex justify-between border-b border-border/40 pb-2">
							<span className="text-muted-foreground">
								{t("claimantLabel")}:
							</span>
							<span className="font-mono text-xs text-foreground">
								{dispute.claimantAddress.slice(0, 6)}...
								{dispute.claimantAddress.slice(-4)} ({dispute.claimantRole})
							</span>
						</div>
					</div>

					<div className="pt-2">
						<span className="text-xs font-medium text-muted-foreground">
							{t("disputeReasonLabel")}:
						</span>
						<p className="mt-1 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
							"{dispute.reason}"
						</p>
					</div>

					{dispute.evidenceUrl && (
						<div className="pt-1">
							<a
								href={dispute.evidenceUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
							>
								<span>{t("viewEvidenceLink")}</span>
								<ExternalLink className="h-3 w-3" />
							</a>
						</div>
					)}
				</div>

				{/* Prior judge determination */}
				<div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
							{t("priorDeterminationHeading")}
						</h2>
						<span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
							<UserCheck className="h-3 w-3 text-primary" />
							{dispute.priorJudgeWinner
								? t("recordedStatus")
								: t("notRecordedStatus")}
						</span>
					</div>

					{dispute.priorJudgeWinner ? (
						<div className="space-y-3 text-sm">
							<div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2">
								<div className="text-xs font-semibold text-foreground">
									{dispute.priorJudgeWinner.participantName ||
										"Designated Winner"}
								</div>
								<div className="font-mono text-xs text-muted-foreground break-all">
									{dispute.priorJudgeWinner.wallet}
								</div>
								{dispute.priorJudgeWinner.notes && (
									<p className="text-xs italic text-muted-foreground">
										"{dispute.priorJudgeWinner.notes}"
									</p>
								)}
							</div>

							<p className="text-xs leading-relaxed text-muted-foreground">
								{t("priorWinnerExplanation")}
							</p>

							{dispute.priorJudgeWinner.submissionUrl && (
								<a
									href={dispute.priorJudgeWinner.submissionUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
								>
									<span>{t("viewSubmissionRepo")}</span>
									<ExternalLink className="h-3 w-3" />
								</a>
							)}
						</div>
					) : (
						<div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
							{t("noPriorWinnerNotice")}
						</div>
					)}
				</div>
			</div>

			{/* Resolution Form or Confirmed Receipt */}
			{stepState === "confirmed" && resolutionRecord ? (
				<div className="rounded-2xl border border-primary/40 bg-card p-6 sm:p-8 shadow-md space-y-6">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
							<CheckCircle2 className="h-6 w-6" />
						</div>
						<div>
							<h2 className="text-xl font-bold text-foreground">
								{t("resolutionConfirmedTitle")}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t("resolutionConfirmedSubtitle")}
							</p>
						</div>
					</div>

					<div className="grid gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-sm sm:grid-cols-2">
						<div>
							<span className="text-xs text-muted-foreground">
								{t("outcomeLabel")}:
							</span>
							<div className="mt-1 font-semibold text-primary">
								{t("outcomeReleaseToWinner")}
							</div>
						</div>
						<div>
							<span className="text-xs text-muted-foreground">
								{t("amountReleasedLabel")}:
							</span>
							<div className="mt-1 font-semibold text-foreground">
								{resolutionRecord.amountUsdc} USDC
							</div>
						</div>
						<div className="sm:col-span-2">
							<span className="text-xs text-muted-foreground">
								{t("winnerDestinationLabel")}:
							</span>
							<div className="mt-1 font-mono text-xs text-foreground break-all">
								{resolutionRecord.winnerWallet}
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
								{t("adjudicationNotesLabel")}:
							</span>
							<p className="mt-1 rounded bg-muted/60 p-2.5 text-xs text-foreground leading-relaxed">
								{resolutionRecord.reasoning}
							</p>
						</div>
					</div>

					<div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
						<div className="font-medium text-foreground">
							{t("stateUpdateTitle")}
						</div>
						<p className="mt-1 leading-relaxed">{t("stateUpdateDesc")}</p>
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
					onSubmit={handleSubmitResolution}
					className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-6"
				>
					<div>
						<h2 className="text-lg font-bold text-foreground">
							{t("actionSectionTitle")}
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{t("actionSectionSubtitle")}
						</p>
					</div>

					{/* Form error alert */}
					{formError && (
						<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 shrink-0" />
							<span>{formError}</span>
						</div>
					)}

					<div className="space-y-4">
						{/* Winner address input */}
						<div>
							<label
								htmlFor="winnerWallet"
								className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
							>
								{t("winnerAddressInputLabel")}
							</label>
							<p className="mt-0.5 text-xs text-muted-foreground">
								{t("winnerAddressInputHelp")}
							</p>
							<input
								id="winnerWallet"
								type="text"
								value={winnerWallet}
								onChange={(e) => setWinnerWallet(e.target.value)}
								disabled={isPending || !isAuthorized}
								placeholder="G... (56-character Stellar address)"
								className="mt-2 block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 font-mono text-xs text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
							/>
						</div>

						{/* Reasoning textarea */}
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

						{/* Good-faith & irrevocability declaration */}
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
					</div>

					{/* Submit & Progress button */}
					<div className="flex flex-col items-end gap-3 pt-2 sm:flex-row sm:justify-between sm:items-center">
						<div className="text-xs text-muted-foreground flex items-center gap-1.5">
							<Lock className="h-3.5 w-3.5 text-muted-foreground" />
							<span>{t("honestStateNotice")}</span>
						</div>

						<button
							type="submit"
							disabled={
								isPending || !isAuthorized || !acceptedTerms || !winnerWallet
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
									<span>{t("signAndReleaseAction")}</span>
								</>
							)}
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
