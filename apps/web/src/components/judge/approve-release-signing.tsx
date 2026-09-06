"use client";

import {
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	Loader2,
	Send,
	Shield,
	Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
	calculateMultisigProgress,
	canSignApprove,
	canSignRelease,
	describeSigningStage,
	truncateStellarKey,
} from "@/lib/judge/judge-helpers";
import type {
	JudgePrize,
	JudgeSignerInfo,
	JudgeSigningStage,
} from "@/lib/judge/types";

interface ApproveReleaseSigningProps {
	prize: JudgePrize;
	signerInfo: JudgeSignerInfo;
	onApproveConfirmed: (prizeId: string, txHash: string) => void;
	onReleaseConfirmed: (prizeId: string, txHash: string) => void;
	className?: string;
}

export function ApproveReleaseSigning({
	prize,
	signerInfo,
	onApproveConfirmed,
	onReleaseConfirmed,
	className = "",
}: ApproveReleaseSigningProps) {
	const t = useTranslations("JudgeSigning");

	const [signingStage, setSigningStage] = useState<JudgeSigningStage>(
		prize.status === "RELEASED"
			? "RELEASED"
			: prize.status === "APPROVED"
				? "APPROVED"
				: "IDLE",
	);

	const [signerState, setSignerState] = useState<JudgeSignerInfo>(signerInfo);
	const [progressPercent, setProgressPercent] = useState<number>(0);
	const [activeTxHash, setActiveTxHash] = useState<string | null>(
		prize.releaseTxHash || prize.approveTxHash || null,
	);
	const [errorText, setErrorText] = useState<string | null>(null);

	const multisig = calculateMultisigProgress(signerState);

	// Handle Step 1: Approve Transaction Signing
	const handleSignApprove = async () => {
		if (!canSignApprove(prize)) return;
		setErrorText(null);
		setSigningStage("APPROVE_BUILDING");

		try {
			// Simulate building unsigned XDR
			await new Promise((r) => setTimeout(r, 600));
			setSigningStage("APPROVE_SIGNING");

			// Simulate wallet popup & signature
			await new Promise((r) => setTimeout(r, 800));
			setSigningStage("APPROVE_PENDING_CONFIRMATION");

			// Simulate race-to-90% consensus wait
			setProgressPercent(20);
			await new Promise((r) => setTimeout(r, 400));
			setProgressPercent(60);
			await new Promise((r) => setTimeout(r, 500));
			setProgressPercent(90);

			// Ledger consensus confirmation
			await new Promise((r) => setTimeout(r, 600));
			setProgressPercent(100);

			const mockApproveHash =
				"a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
			setActiveTxHash(mockApproveHash);
			setSigningStage("APPROVED");
			onApproveConfirmed(prize.id, mockApproveHash);
		} catch (err) {
			setSigningStage("FAILED");
			setErrorText(
				err instanceof Error ? err.message : "Approve signature failed",
			);
		}
	};

	// Handle Step 2: Release Transaction Signing
	const handleSignRelease = async () => {
		if (!canSignRelease(prize)) return;
		setErrorText(null);
		setSigningStage("RELEASE_BUILDING");

		try {
			await new Promise((r) => setTimeout(r, 600));
			setSigningStage("RELEASE_SIGNING");

			await new Promise((r) => setTimeout(r, 800));
			setSigningStage("RELEASE_PENDING_CONFIRMATION");

			setProgressPercent(30);
			await new Promise((r) => setTimeout(r, 400));
			setProgressPercent(75);
			await new Promise((r) => setTimeout(r, 500));
			setProgressPercent(92);

			await new Promise((r) => setTimeout(r, 700));
			setProgressPercent(100);

			const mockReleaseHash =
				"f9e8d7c6b5a43210987654321fedcba0987654321fedcba0987654321fedcba0";
			setActiveTxHash(mockReleaseHash);
			setSigningStage("RELEASED");
			onReleaseConfirmed(prize.id, mockReleaseHash);
		} catch (err) {
			setSigningStage("FAILED");
			setErrorText(
				err instanceof Error ? err.message : "Release signature failed",
			);
		}
	};

	// Co-signature action for multisig judges
	const handleAddCoSignature = () => {
		if (signerState.collectedSignatures < signerState.requiredSignatures) {
			setSignerState((prev) => ({
				...prev,
				collectedSignatures: prev.collectedSignatures + 1,
			}));
		}
	};

	const stageDescription = describeSigningStage(signingStage);

	return (
		<div
			className={`rounded-3xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur space-y-6 ${className}`}
			data-testid="approve-release-panel"
		>
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
				<div>
					<h3 className="text-xl font-bold text-white flex items-center gap-2">
						<Shield className="size-5 text-blue-400" />
						{t("panelTitle")}
					</h3>
					<p className="text-xs text-zinc-400 mt-1">
						{t("panelSubtitle", {
							prize: prize.title,
							amount: prize.amount.toLocaleString(),
							currency: prize.currency,
						})}
					</p>
				</div>

				{/* Multisig Badge */}
				<div className="rounded-2xl border border-white/10 bg-black/40 p-3 flex items-center gap-3">
					<Users className="size-4 text-blue-400 shrink-0" />
					<div className="text-xs">
						<span className="font-semibold text-white block">
							{signerState.isMultisig
								? t("multisigLabel")
								: t("singleSignerLabel")}
						</span>
						<span className="text-zinc-400 font-mono text-[11px]">
							{multisig.displayString}
						</span>
					</div>
					{signerState.isMultisig && !multisig.isThresholdMet && (
						<button
							type="button"
							onClick={handleAddCoSignature}
							className="rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 px-2 py-1 text-[10px] font-semibold transition-colors"
						>
							+ {t("addCoSignButton")}
						</button>
					)}
				</div>
			</div>

			{/* Non-Optimistic Progress Indicator */}
			{stageDescription.isOngoing && (
				<div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5 space-y-3">
					<div className="flex items-center justify-between text-xs">
						<span className="font-semibold text-blue-300 flex items-center gap-2">
							<Loader2 className="size-4 animate-spin text-blue-400" />
							{stageDescription.label}
						</span>
						<span className="font-mono text-blue-400 font-bold">
							{progressPercent}%
						</span>
					</div>
					<div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/5">
						<div
							className="bg-gradient-to-r from-blue-600 to-emerald-500 h-2 rounded-full transition-all duration-300 ease-out"
							style={{ width: `${progressPercent}%` }}
							role="progressbar"
							aria-valuenow={progressPercent}
							aria-valuemin={0}
							aria-valuemax={100}
						/>
					</div>
					<p className="text-[11px] text-zinc-400 italic">
						{t("nonOptimisticNotice")}
					</p>
				</div>
			)}

			{/* Step 1: Approve Signing Container */}
			<div
				className={`rounded-2xl border p-5 transition-all ${
					prize.status === "APPROVED" || prize.status === "RELEASED"
						? "border-emerald-500/30 bg-emerald-950/10"
						: "border-white/10 bg-black/30"
				}`}
			>
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<span className="font-mono text-xs font-bold text-zinc-500">
								STEP 1
							</span>
							<h4 className="font-semibold text-white text-sm">
								{t("step1Title")}
							</h4>
							{(prize.status === "APPROVED" || prize.status === "RELEASED") && (
								<CheckCircle2 className="size-4 text-emerald-400" />
							)}
						</div>
						<p className="text-xs text-zinc-400 mt-1 max-w-md">
							{t("step1Desc")}
						</p>
					</div>

					<button
						type="button"
						onClick={handleSignApprove}
						disabled={
							!canSignApprove(prize) ||
							stageDescription.isOngoing ||
							prize.status === "APPROVED" ||
							prize.status === "RELEASED"
						}
						className="rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
						data-testid="sign-approve-button"
					>
						<Send className="size-3.5" />
						{prize.status === "APPROVED" || prize.status === "RELEASED"
							? t("approvedOnChainBadge")
							: t("signApproveButton")}
					</button>
				</div>
			</div>

			{/* Step 2: Release Signing Container */}
			<div
				className={`rounded-2xl border p-5 transition-all ${
					prize.status === "RELEASED"
						? "border-emerald-500/40 bg-emerald-950/20 ring-1 ring-emerald-500/20"
						: prize.status === "APPROVED"
							? "border-blue-500/40 bg-blue-950/20"
							: "border-white/5 bg-black/20 opacity-60"
				}`}
			>
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<span className="font-mono text-xs font-bold text-zinc-500">
								STEP 2
							</span>
							<h4 className="font-semibold text-white text-sm">
								{t("step2Title")}
							</h4>
							{prize.status === "RELEASED" && (
								<CheckCircle2 className="size-4 text-emerald-400" />
							)}
						</div>
						<p className="text-xs text-zinc-400 mt-1 max-w-md">
							{t("step2Desc", {
								winner: prize.assignedWinnerWallet
									? truncateStellarKey(prize.assignedWinnerWallet)
									: t("unassigned"),
							})}
						</p>
					</div>

					<button
						type="button"
						onClick={handleSignRelease}
						disabled={
							!canSignRelease(prize) ||
							stageDescription.isOngoing ||
							prize.status === "RELEASED"
						}
						className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
						data-testid="sign-release-button"
					>
						<Send className="size-3.5" />
						{prize.status === "RELEASED"
							? t("releasedBadge")
							: t("signReleaseButton")}
					</button>
				</div>
			</div>

			{/* Error State */}
			{errorText && (
				<div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300 flex items-center gap-2">
					<AlertTriangle className="size-4 shrink-0" />
					<span>{errorText}</span>
				</div>
			)}

			{/* Transaction Explorer Confirmation Link */}
			{activeTxHash && (
				<div className="rounded-xl bg-black/40 border border-white/5 p-3 flex items-center justify-between text-xs">
					<span className="text-zinc-400 flex items-center gap-2">
						<CheckCircle2 className="size-3.5 text-emerald-400" />
						{t("txConfirmedNotice")}
					</span>
					<a
						href={`https://stellar.expert/explorer/testnet/tx/${activeTxHash}`}
						target="_blank"
						rel="noreferrer"
						className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono text-[11px]"
					>
						<span>{truncateStellarKey(activeTxHash, 8, 8)}</span>
						<ExternalLink className="size-3" />
					</a>
				</div>
			)}
		</div>
	);
}
