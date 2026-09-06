"use client";

import {
	AlertCircle,
	CheckCircle2,
	ExternalLink,
	FileText,
	Loader2,
	Scale,
	ShieldAlert,
	ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { submitDisputeAction } from "@/app/[locale]/events/[id]/dispute/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { checkDisputeEligibility } from "@/lib/dispute/eligibility";
import type {
	DisputeEventContext,
	DisputeRecord,
	OpenDisputeInput,
} from "@/lib/dispute/types";
import { useWallet } from "@/lib/wallet/provider";

export interface OpenDisputeFormProps {
	event: DisputeEventContext;
}

export function OpenDisputeForm({ event }: OpenDisputeFormProps) {
	const t = useTranslations("Dispute");
	const { address } = useWallet();

	const [milestoneId, setMilestoneId] = useState<string>(
		event.prizes?.[0]?.id || "",
	);
	const [reason, setReason] = useState("");
	const [evidenceUrl, setEvidenceUrl] = useState("");
	const [acceptedTerms, setAcceptedTerms] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [submittedDispute, setSubmittedDispute] =
		useState<DisputeRecord | null>(null);

	const eligibility = checkDisputeEligibility(event, address || undefined);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!address) {
			setErrorMessage(t("walletRequiredError"));
			return;
		}

		if (reason.trim().length < 15) {
			setErrorMessage(t("reasonTooShortError"));
			return;
		}

		if (!acceptedTerms) {
			setErrorMessage(t("termsRequiredError"));
			return;
		}

		setIsSubmitting(true);
		setErrorMessage(null);

		try {
			const input: OpenDisputeInput = {
				eventId: event.id,
				milestoneId: milestoneId || undefined,
				callerAddress: address,
				reason: reason.trim(),
				evidenceUrl: evidenceUrl.trim() || undefined,
			};

			const res = await submitDisputeAction(input);
			if (!res.success || !res.dispute) {
				setErrorMessage(res.error || t("genericSubmitError"));
			} else {
				setSubmittedDispute(res.dispute);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : t("genericSubmitError");
			setErrorMessage(msg);
		} finally {
			setIsSubmitting(false);
		}
	}

	if (submittedDispute) {
		return (
			<div className="rounded-2xl border border-emerald-500/20 bg-zinc-900/90 p-8 text-white shadow-2xl backdrop-blur-xl">
				<div className="flex items-center gap-3 text-emerald-400">
					<CheckCircle2 className="size-8" />
					<div>
						<h3 className="font-serif text-2xl font-bold">
							{t("successTitle")}
						</h3>
						<p className="text-sm text-zinc-400">{t("successSubtitle")}</p>
					</div>
				</div>

				<div className="mt-6 space-y-3 rounded-xl border border-white/5 bg-black/40 p-4 font-mono text-xs">
					<div className="flex justify-between">
						<span className="text-zinc-400">{t("disputeIdLabel")}:</span>
						<span className="text-zinc-200">{submittedDispute.id}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-zinc-400">{t("roleLabel")}:</span>
						<span className="text-blue-400 uppercase">
							{submittedDispute.role}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-zinc-400">{t("statusLabel")}:</span>
						<span className="text-amber-400 uppercase">
							{submittedDispute.status}
						</span>
					</div>
					{submittedDispute.evidenceUrl && (
						<div className="flex justify-between truncate">
							<span className="text-zinc-400">{t("evidenceLabel")}:</span>
							<a
								href={submittedDispute.evidenceUrl}
								target="_blank"
								rel="noreferrer"
								className="flex items-center gap-1 text-blue-400 hover:underline"
							>
								{submittedDispute.evidenceUrl}
								<ExternalLink className="size-3" />
							</a>
						</div>
					)}
				</div>

				<div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
					<p>{t("disputedStateNotice")}</p>
				</div>

				<div className="mt-8 flex justify-end">
					<Link href="/">
						<Button variant="outline">{t("returnHomeAction")}</Button>
					</Link>
				</div>
			</div>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-2xl border border-white/10 bg-zinc-900/90 p-6 text-white shadow-2xl backdrop-blur-xl md:p-8"
		>
			<div className="flex items-start justify-between border-b border-white/10 pb-5">
				<div>
					<div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-400">
						<Scale className="size-3.5" />
						<span>{t("badge")}</span>
					</div>
					<h2 className="mt-3 font-serif text-2xl font-bold md:text-3xl">
						{t("formTitle")}
					</h2>
					<p className="mt-1 text-sm text-zinc-400">
						{t("formSubtitle", { eventTitle: event.title })}
					</p>
				</div>
			</div>

			{/* Wallet connection banner / Role badge */}
			<div className="mt-6">
				{!address ? (
					<div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-300">
						<ShieldAlert className="size-5 shrink-0" />
						<p>{t("connectWalletNotice")}</p>
					</div>
				) : eligibility.role === "resolver" ? (
					<div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
						<ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-400" />
						<div>
							<h4 className="font-semibold text-white">
								{t("resolverBlockedTitle")}
							</h4>
							<p className="mt-1 text-xs text-rose-200">
								{t("resolverBlockedDescription")}
							</p>
						</div>
					</div>
				) : eligibility.role === "unauthorized" ? (
					<div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
						<AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-400" />
						<div>
							<h4 className="font-semibold text-white">
								{t("unauthorizedTitle")}
							</h4>
							<p className="mt-1 text-xs text-amber-200">
								{t("unauthorizedDescription")}
							</p>
						</div>
					</div>
				) : (
					<div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
						<div className="flex items-center gap-2">
							<ShieldCheck className="size-4 text-emerald-400" />
							<span className="text-zinc-300">{t("connectedAs")}:</span>
							<span className="font-mono text-zinc-100">
								{address.slice(0, 6)}...{address.slice(-4)}
							</span>
						</div>
						<span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2.5 py-0.5 font-semibold text-blue-300 uppercase">
							{eligibility.role}
						</span>
					</div>
				)}
			</div>

			{/* Milestone Selection if applicable */}
			{event.prizes && event.prizes.length > 0 && (
				<div className="mt-6 space-y-2">
					<label
						htmlFor="milestone-select"
						className="block text-xs font-semibold tracking-wider text-zinc-400 uppercase"
					>
						{t("affectedMilestoneLabel")}
					</label>
					<select
						id="milestone-select"
						value={milestoneId}
						onChange={(e) => setMilestoneId(e.target.value)}
						disabled={eligibility.role === "resolver"}
						className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
					>
						{event.prizes.map((p) => (
							<option key={p.id} value={p.id}>
								{p.title} (${p.amountUsdc.toLocaleString()} USDC) — {p.status}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Reason Textarea */}
			<div className="mt-6 space-y-2">
				<div className="flex items-center justify-between">
					<label
						htmlFor="dispute-reason"
						className="block text-xs font-semibold tracking-wider text-zinc-400 uppercase"
					>
						{t("reasonLabel")} <span className="text-rose-400">*</span>
					</label>
					<span className="text-xs text-zinc-500">
						{reason.length}/2000 {t("charsLabel")}
					</span>
				</div>
				<textarea
					id="dispute-reason"
					rows={4}
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					disabled={eligibility.role === "resolver" || isSubmitting}
					placeholder={t("reasonPlaceholder")}
					className="w-full rounded-xl border border-white/10 bg-zinc-900 p-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			{/* Evidence URL Input */}
			<div className="mt-6 space-y-2">
				<label
					htmlFor="evidence-url"
					className="block text-xs font-semibold tracking-wider text-zinc-400 uppercase"
				>
					{t("evidenceUrlLabel")}{" "}
					<span className="text-zinc-500 font-normal">
						({t("optionalLabel")})
					</span>
				</label>
				<div className="relative">
					<FileText className="pointer-events-none absolute top-3 left-3.5 size-4 text-zinc-500" />
					<input
						id="evidence-url"
						type="url"
						value={evidenceUrl}
						onChange={(e) => setEvidenceUrl(e.target.value)}
						disabled={eligibility.role === "resolver" || isSubmitting}
						placeholder="https://github.com/org/repo/pull/123 or IPFS CID"
						className="w-full rounded-xl border border-white/10 bg-zinc-900 py-2.5 pr-3.5 pl-10 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
					/>
				</div>
			</div>

			{/* Good faith terms checkbox */}
			<div className="mt-6 flex items-start gap-3">
				<input
					id="terms-checkbox"
					type="checkbox"
					checked={acceptedTerms}
					onChange={(e) => setAcceptedTerms(e.target.checked)}
					disabled={eligibility.role === "resolver" || isSubmitting}
					className="mt-1 size-4 rounded border-white/20 bg-zinc-900 text-blue-600 focus:ring-blue-500"
				/>
				<label
					htmlFor="terms-checkbox"
					className="text-xs leading-relaxed text-zinc-400"
				>
					{t("termsStatement")}
				</label>
			</div>

			{/* Error Message */}
			{errorMessage && (
				<div className="mt-6 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-300">
					<AlertCircle className="size-4 shrink-0" />
					<span>{errorMessage}</span>
				</div>
			)}

			{/* Submit button */}
			<div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5">
				<Link href="/">
					<Button type="button" variant="ghost" className="text-zinc-400">
						{t("cancelAction")}
					</Button>
				</Link>
				<Button
					type="submit"
					disabled={
						!address ||
						eligibility.role === "resolver" ||
						!eligibility.eligible ||
						isSubmitting
					}
					className="bg-amber-500 font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isSubmitting ? (
						<>
							<Loader2 className="mr-2 size-4 animate-spin" />
							{t("submittingDispute")}
						</>
					) : (
						<>
							<Scale className="mr-2 size-4" />
							{t("submitDisputeAction")}
						</>
					)}
				</Button>
			</div>
		</form>
	);
}
