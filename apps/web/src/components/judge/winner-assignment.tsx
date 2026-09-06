"use client";

import {
	AlertTriangle,
	Award,
	CheckCircle2,
	DollarSign,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { truncateStellarKey } from "@/lib/judge/judge-helpers";
import type { JudgePrize } from "@/lib/judge/types";
import { hasUsdcTrustline } from "@/lib/trustline/verify-trustline";

interface WinnerAssignmentProps {
	prize: JudgePrize;
	onAssignWinnerConfirmed: (prizeId: string, winnerWallet: string) => void;
	className?: string;
}

export function WinnerAssignment({
	prize,
	onAssignWinnerConfirmed,
	className = "",
}: WinnerAssignmentProps) {
	const t = useTranslations("JudgeWinnerAssignment");
	const [winnerWallet, setWinnerWallet] = useState(
		prize.assignedWinnerWallet || "",
	);
	const [trustlineState, setTrustlineState] = useState<
		"IDLE" | "CHECKING" | "ACTIVE" | "MISSING" | "ERROR"
	>("IDLE");
	const [isVerifying, setIsVerifying] = useState(false);

	const verifyWinnerTrustline = useCallback(async (address: string) => {
		if (!address || address.length < 20) {
			setTrustlineState("IDLE");
			return;
		}
		setIsVerifying(true);
		setTrustlineState("CHECKING");
		try {
			const active = await hasUsdcTrustline(address);
			setTrustlineState(active ? "ACTIVE" : "MISSING");
		} catch {
			setTrustlineState("ERROR");
		} finally {
			setIsVerifying(false);
		}
	}, []);

	useEffect(() => {
		if (prize.assignedWinnerWallet) {
			setWinnerWallet(prize.assignedWinnerWallet);
			verifyWinnerTrustline(prize.assignedWinnerWallet);
		}
	}, [prize.assignedWinnerWallet, verifyWinnerTrustline]);

	const handleConfirm = () => {
		if (winnerWallet && trustlineState === "ACTIVE") {
			onAssignWinnerConfirmed(prize.id, winnerWallet);
		}
	};

	return (
		<div
			className={`rounded-3xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur space-y-6 ${className}`}
			data-testid="winner-assignment-card"
		>
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
				<div>
					<div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-2">
						<Award className="size-3.5" />
						<span>{t("badge")}</span>
					</div>
					<h3 className="text-xl font-bold text-white">{prize.title}</h3>
					<p className="text-xs text-zinc-400 mt-0.5">
						{t("prizeAllocationSubtitle", {
							amount: prize.amount.toLocaleString(),
							currency: prize.currency,
						})}
					</p>
				</div>
				<div className="rounded-2xl bg-black/40 border border-white/5 px-4 py-2.5 flex items-center gap-2">
					<DollarSign className="size-4 text-emerald-400" />
					<span className="font-mono text-sm font-bold text-white">
						{prize.amount.toLocaleString()} {prize.currency}
					</span>
				</div>
			</div>

			{/* Winner Selection Field */}
			<div className="space-y-2">
				<label
					htmlFor="winner-wallet-input"
					className="block text-xs font-medium text-zinc-300"
				>
					{t("winnerWalletLabel")} <span className="text-red-400">*</span>
				</label>
				<div className="flex gap-2">
					<input
						id="winner-wallet-input"
						type="text"
						value={winnerWallet}
						onChange={(e) => setWinnerWallet(e.target.value.trim())}
						placeholder="G..."
						disabled={
							prize.status === "APPROVED" || prize.status === "RELEASED"
						}
						className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none font-mono disabled:opacity-50"
					/>
					<button
						type="button"
						onClick={() => verifyWinnerTrustline(winnerWallet)}
						disabled={!winnerWallet || isVerifying}
						className="rounded-xl border border-white/10 hover:border-white/20 bg-zinc-800 px-3.5 py-2.5 text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-40"
					>
						<RefreshCw
							className={`size-3.5 ${isVerifying ? "animate-spin" : ""}`}
						/>
						{t("verifyButton")}
					</button>
				</div>
			</div>

			{/* Trustline Re-check Feedback (ADR-004) */}
			{trustlineState === "ACTIVE" && (
				<div
					className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs flex items-start gap-3"
					data-testid="trustline-verified-banner"
				>
					<CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
					<div>
						<p className="font-semibold text-emerald-300">
							{t("trustlineVerifiedTitle")}
						</p>
						<p className="text-zinc-400 mt-0.5">{t("trustlineVerifiedDesc")}</p>
					</div>
				</div>
			)}

			{trustlineState === "MISSING" && (
				<div
					className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs flex items-start gap-3"
					data-testid="trustline-missing-banner"
				>
					<AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
					<div className="space-y-1">
						<p className="font-semibold text-amber-300">
							{t("trustlineMissingTitle")}
						</p>
						<p className="text-zinc-300">{t("trustlineMissingDesc")}</p>
					</div>
				</div>
			)}

			{trustlineState === "ERROR" && (
				<div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300 flex items-center gap-2">
					<AlertTriangle className="size-4 shrink-0" />
					<span>{t("trustlineErrorText")}</span>
				</div>
			)}

			{/* Gating Action Button */}
			<div className="pt-2">
				<button
					type="button"
					onClick={handleConfirm}
					disabled={
						!winnerWallet ||
						trustlineState !== "ACTIVE" ||
						prize.status === "APPROVED" ||
						prize.status === "RELEASED"
					}
					className="w-full rounded-2xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs py-3 px-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					data-testid="confirm-winner-assignment-btn"
				>
					<ShieldCheck className="size-4 text-emerald-600" />
					{prize.assignedWinnerWallet === winnerWallet
						? t("winnerConfirmedLabel", {
								wallet: truncateStellarKey(winnerWallet),
							})
						: t("confirmAssignmentButton")}
				</button>
			</div>
		</div>
	);
}
