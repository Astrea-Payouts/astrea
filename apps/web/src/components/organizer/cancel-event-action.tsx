"use client";

import {
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	Gavel,
	Loader2,
	Lock,
	Scale,
	ShieldAlert,
	ShieldCheck,
	Undo2,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cancelPreLiveEventAction } from "@/app/[locale]/events/[id]/cancel/actions";
import { TxHashLink } from "@/components/tx-hash-link";
import {
	getCancellationPath,
	verifyCancellationEligibility,
} from "@/lib/cancellation/cancellation";
import type {
	CancellationContext,
	PreLiveCancelRecord,
} from "@/lib/cancellation/types";
import { useWallet } from "@/lib/wallet/provider";

interface CancelEventActionProps {
	context: CancellationContext;
	locale: string;
}

type StepState = "idle" | "submitting" | "confirming" | "confirmed";

export function CancelEventAction({ context, locale }: CancelEventActionProps) {
	const t = useTranslations("EventCancellation");
	const { address: userWallet, connect } = useWallet();

	const path = getCancellationPath(context.status);
	const authCheck = verifyCancellationEligibility(userWallet, context);
	const isAuthorized = authCheck.isAuthorized;

	const [cancellationReason, setCancellationReason] = useState("");
	const [confirmedTerms, setConfirmedTerms] = useState(false);
	const [stepState, setStepState] = useState<StepState>("idle");
	const [record, setRecord] = useState<PreLiveCancelRecord | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	const isPending = stepState === "submitting" || stepState === "confirming";

	const handlePreLiveCancel = async (e: React.FormEvent) => {
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

		if (!confirmedTerms) {
			setFormError(t("termsRequired"));
			return;
		}

		try {
			setStepState("submitting");

			setTimeout(() => {
				setStepState("confirming");
			}, 600);

			const result = await cancelPreLiveEventAction({
				eventId: context.eventId,
				organizerWallet: userWallet,
				cancellationReason: cancellationReason.trim() || undefined,
			});

			if (!result.success || !result.record) {
				setStepState("idle");
				setFormError(result.error || t("genericError"));
				return;
			}

			setRecord(result.record);
			setStepState("confirmed");
		} catch (err) {
			console.error("Pre-LIVE cancellation failed:", err);
			setStepState("idle");
			setFormError(t("genericError"));
		}
	};

	return (
		<div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
			{/* Header */}
			<div className="border-b border-border/40 pb-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							<Undo2 className="h-4 w-4 text-destructive" />
							<span>{t("badge")}</span>
							<span>•</span>
							<span className="font-mono">{context.eventId}</span>
						</div>
						<h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
							{t("pageTitle")}
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("pageSubtitle", { eventTitle: context.eventTitle })}
						</p>
					</div>

					{/* Event status indicator */}
					<div className="flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1.5 text-xs">
						<span className="text-muted-foreground">{t("statusLabel")}:</span>
						<span className="font-bold text-foreground">{context.status}</span>
					</div>
				</div>
			</div>

			{/* Wallet connection / organizer check banner */}
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
			) : !isAuthorized ? (
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
									expected: `${context.organizerAddress.slice(0, 6)}...${context.organizerAddress.slice(-4)}`,
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

			{/* Event Context Card */}
			<div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
				<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
					{t("overviewHeading")}
				</h2>
				<div className="grid gap-3 text-sm sm:grid-cols-2">
					<div className="flex justify-between border-b border-border/40 pb-2 sm:border-b-0">
						<span className="text-muted-foreground">
							{t("escrowBalanceLabel")}:
						</span>
						<span className="font-bold text-primary">
							{context.totalEscrowUsdc.toLocaleString()} {context.currency}
						</span>
					</div>
					<div className="flex justify-between border-b border-border/40 pb-2 sm:border-b-0">
						<span className="text-muted-foreground">
							{t("participantsLabel")}:
						</span>
						<span className="font-semibold text-foreground">
							{context.registeredParticipantsCount} registered
						</span>
					</div>
					<div className="flex justify-between border-b border-border/40 pb-2 sm:border-b-0">
						<span className="text-muted-foreground">
							{t("refundDestinationLabel")}:
						</span>
						<span className="font-mono text-xs text-foreground">
							{context.adminWalletAddress.slice(0, 6)}...
							{context.adminWalletAddress.slice(-4)}
						</span>
					</div>
					<div className="flex justify-between pb-2">
						<span className="text-muted-foreground">
							{t("escrowMechanismLabel")}:
						</span>
						<span className="font-medium text-foreground">
							{path === "PRE_LIVE_REFUND"
								? t("mechanismPreLive")
								: t("mechanismPostLive")}
						</span>
					</div>
				</div>
			</div>

			{/* STATE-GATED SECTION: Two genuinely different mechanisms */}
			{path === "PRE_LIVE_REFUND" ? (
				/* PRE-LIVE PATH: Instant cancel_event signing & full refund */
				stepState === "confirmed" && record ? (
					<div className="rounded-2xl border border-primary/40 bg-card p-6 sm:p-8 shadow-md space-y-6">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
								<CheckCircle2 className="h-6 w-6" />
							</div>
							<div>
								<h2 className="text-xl font-bold text-foreground">
									{t("cancelConfirmedTitle")}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t("cancelConfirmedSubtitle")}
								</p>
							</div>
						</div>

						<div className="grid gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-sm sm:grid-cols-2">
							<div>
								<span className="text-xs text-muted-foreground">
									{t("refundAmountLabel")}:
								</span>
								<div className="mt-1 font-bold text-primary">
									{record.refundAmountUsdc.toLocaleString()} USDC
								</div>
							</div>
							<div>
								<span className="text-xs text-muted-foreground">
									{t("destinationWalletLabel")}:
								</span>
								<div className="mt-1 font-mono text-xs text-foreground break-all">
									{record.adminWalletAddress}
								</div>
							</div>
							<div className="sm:col-span-2">
								<span className="text-xs text-muted-foreground">
									{t("txHashLabel")}:
								</span>
								<div className="mt-1">
									<TxHashLink hash={record.txHash} />
								</div>
							</div>
						</div>

						<div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
							<span className="font-semibold text-foreground">
								{t("refundNoticeHeader")}:
							</span>{" "}
							{t("refundNoticeBody")}
						</div>

						<div className="flex justify-end pt-2">
							<Link
								href={`/${locale}/organizer`}
								className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
							>
								<span>{t("returnToDashboardAction")}</span>
								<ArrowRight className="h-4 w-4" />
							</Link>
						</div>
					</div>
				) : (
					<form
						onSubmit={handlePreLiveCancel}
						className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-6"
					>
						<div>
							<h2 className="text-lg font-bold text-foreground">
								{t("preLiveFormTitle")}
							</h2>
							<p className="mt-1 text-xs text-muted-foreground leading-relaxed">
								{t("preLiveFormDesc", {
									amount: context.totalEscrowUsdc.toLocaleString(),
								})}
							</p>
						</div>

						{formError && (
							<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
								<AlertCircle className="h-4 w-4 shrink-0" />
								<span>{formError}</span>
							</div>
						)}

						<div className="space-y-4">
							<div>
								<label
									htmlFor="cancelReason"
									className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
								>
									{t("reasonOptionalLabel")}
								</label>
								<input
									id="cancelReason"
									type="text"
									value={cancellationReason}
									onChange={(e) => setCancellationReason(e.target.value)}
									disabled={isPending || !isAuthorized}
									placeholder={t("reasonPlaceholder")}
									className="mt-2 block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-xs text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
								/>
							</div>

							<div className="rounded-lg border border-border/80 bg-muted/20 p-3.5">
								<label className="flex items-start gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={confirmedTerms}
										onChange={(e) => setConfirmedTerms(e.target.checked)}
										disabled={isPending || !isAuthorized}
										className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
									/>
									<span className="text-xs text-muted-foreground leading-relaxed">
										{t("preLiveTermsCheckbox")}
									</span>
								</label>
							</div>
						</div>

						<div className="flex flex-col items-end gap-3 pt-2 sm:flex-row sm:justify-between sm:items-center">
							<div className="text-xs text-muted-foreground flex items-center gap-1.5">
								<Lock className="h-3.5 w-3.5 text-muted-foreground" />
								<span>{t("honestStateNotice")}</span>
							</div>

							<button
								type="submit"
								disabled={isPending || !isAuthorized || !confirmedTerms}
								className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-6 py-2.5 text-sm font-medium text-destructive-foreground shadow transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										<span>
											{stepState === "submitting"
												? t("submittingTxState")
												: t("confirmingTxState")}
										</span>
									</>
								) : (
									<>
										<Undo2 className="h-4 w-4" />
										<span>{t("signCancelEventAction")}</span>
									</>
								)}
							</button>
						</div>
					</form>
				)
			) : (
				/* POST-LIVE PATH: Direct refund strictly blocked! Routes to Dispute Resolution */
				<div className="rounded-2xl border border-destructive/40 bg-card p-6 sm:p-8 shadow-sm space-y-6">
					<div className="flex items-start gap-3.5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
							<ShieldAlert className="h-6 w-6" />
						</div>
						<div className="space-y-1">
							<h2 className="text-xl font-bold text-destructive">
								{t("postLiveBlockedTitle")}
							</h2>
							<p className="text-sm text-muted-foreground leading-relaxed">
								{t("postLiveBlockedSubtitle")}
							</p>
						</div>
					</div>

					{/* Explanatory callout */}
					<div className="rounded-xl border border-border/80 bg-muted/20 p-5 space-y-3 text-xs leading-relaxed text-muted-foreground">
						<div className="font-semibold text-foreground flex items-center gap-2">
							<Scale className="h-4 w-4 text-primary" />
							<span>{t("adr006RationaleHeader")}</span>
						</div>
						<p>{t("adr006RationaleBody")}</p>
					</div>

					<div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border/40">
						<div className="text-xs text-muted-foreground flex items-center gap-1.5">
							<Gavel className="h-3.5 w-3.5 text-primary" />
							<span>{t("resolverAdjudicationNotice")}</span>
						</div>

						<Link
							href={`/${locale}/events/${context.eventId}/dispute/cancel`}
							className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
						>
							<span>{t("openCancellationDisputeAction")}</span>
							<ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
