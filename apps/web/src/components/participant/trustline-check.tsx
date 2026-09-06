"use client";

import {
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { env } from "@/lib/env";
import type { UsdcTrustlineState } from "@/lib/participant/types";
import { hasUsdcTrustline } from "@/lib/trustline/verify-trustline";

interface TrustlineCheckProps {
	publicKey?: string | null;
	onStatusChange?: (status: UsdcTrustlineState) => void;
	initialStatus?: UsdcTrustlineState;
	className?: string;
}

export function TrustlineCheck({
	publicKey,
	onStatusChange,
	initialStatus = "IDLE",
	className = "",
}: TrustlineCheckProps) {
	const t = useTranslations("ParticipantTrustline");
	const [status, setStatus] = useState<UsdcTrustlineState>(initialStatus);
	const [isFixing, setIsFixing] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const checkTrustline = useCallback(
		async (key: string) => {
			setStatus("CHECKING");
			setErrorMessage(null);
			try {
				const active = await hasUsdcTrustline(key);
				const newStatus: UsdcTrustlineState = active ? "ACTIVE" : "MISSING";
				setStatus(newStatus);
				onStatusChange?.(newStatus);
			} catch (err) {
				setStatus("ERROR");
				setErrorMessage(
					err instanceof Error
						? err.message
						: "Failed to query Stellar Horizon",
				);
				onStatusChange?.("ERROR");
			}
		},
		[onStatusChange],
	);

	useEffect(() => {
		if (publicKey) {
			checkTrustline(publicKey);
		} else {
			setStatus("IDLE");
		}
	}, [publicKey, checkTrustline]);

	if (!publicKey || status === "IDLE") {
		return (
			<div
				className={`rounded-2xl border border-white/10 bg-zinc-900/40 p-5 text-zinc-400 text-sm flex items-center gap-3 ${className}`}
				data-testid="trustline-idle"
			>
				<ShieldCheck className="size-5 text-zinc-500 shrink-0" />
				<p>{t("connectPrompt")}</p>
			</div>
		);
	}

	if (status === "CHECKING") {
		return (
			<div
				className={`rounded-2xl border border-blue-500/20 bg-blue-950/20 p-5 text-sm flex items-center justify-between gap-4 ${className}`}
				data-testid="trustline-checking"
			>
				<div className="flex items-center gap-3">
					<RefreshCw className="size-5 text-blue-400 animate-spin shrink-0" />
					<div>
						<p className="font-medium text-white">{t("checkingTitle")}</p>
						<p className="text-xs text-zinc-400 mt-0.5">{t("checkingDesc")}</p>
					</div>
				</div>
			</div>
		);
	}

	if (status === "ACTIVE") {
		return (
			<div
				className={`rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
				data-testid="trustline-active"
			>
				<div className="flex items-start gap-3">
					<CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" />
					<div>
						<p className="font-semibold text-emerald-300">{t("activeTitle")}</p>
						<p className="text-xs text-zinc-400 mt-1 max-w-md">
							{t("activeDesc", { symbol: env.USDC_SYMBOL })}
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => publicKey && checkTrustline(publicKey)}
					className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors w-fit"
				>
					<RefreshCw className="size-3.5" />
					{t("recheckButton")}
				</button>
			</div>
		);
	}

	if (status === "MISSING") {
		return (
			<div
				className={`rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 sm:p-6 text-sm flex flex-col gap-4 ${className}`}
				data-testid="trustline-missing"
			>
				<div className="flex items-start gap-3">
					<AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
					<div>
						<h4 className="font-semibold text-amber-300 text-base">
							{t("missingTitle")}
						</h4>
						<p className="text-xs text-zinc-300 mt-1 leading-relaxed">
							{t("missingDesc", { symbol: env.USDC_SYMBOL })}
						</p>
					</div>
				</div>

				<div className="rounded-xl bg-black/40 p-3.5 border border-white/5 flex flex-col gap-2">
					<p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
						{t("fixItGuidanceHeader")}
					</p>
					<ul className="text-xs text-zinc-400 list-disc list-inside space-y-1">
						<li>{t("fixStep1")}</li>
						<li>
							{t("fixStep2", {
								symbol: env.USDC_SYMBOL,
								issuer: `${env.USDC_ISSUER.slice(0, 8)}...`,
							})}
						</li>
						<li>{t("fixStep3")}</li>
					</ul>
				</div>

				<div className="flex flex-wrap items-center gap-3 pt-1">
					<button
						type="button"
						onClick={() => {
							setIsFixing(true);
							// Simulate opening wallet / guiding trustline addition
							window.open(
								`https://laboratory.stellar.org/#txbuilder?params=&network=testnet`,
								"_blank",
							);
							setTimeout(() => setIsFixing(false), 2000);
						}}
						className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs px-4 py-2.5 transition-colors"
					>
						{isFixing ? t("openingGuide") : t("fixNowButton")}
						<ExternalLink className="size-3.5" />
					</button>

					<button
						type="button"
						onClick={() => publicKey && checkTrustline(publicKey)}
						className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-zinc-900/60 px-4 py-2.5 text-xs font-medium text-white transition-colors"
					>
						<RefreshCw className="size-3.5" />
						{t("recheckButton")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`rounded-2xl border border-red-500/30 bg-red-950/20 p-5 text-sm flex flex-col gap-3 ${className}`}
			data-testid="trustline-error"
		>
			<div className="flex items-start gap-3">
				<AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />
				<div>
					<p className="font-semibold text-red-300">{t("errorTitle")}</p>
					<p className="text-xs text-zinc-400 mt-1">
						{errorMessage || t("errorDesc")}
					</p>
				</div>
			</div>
			<button
				type="button"
				onClick={() => publicKey && checkTrustline(publicKey)}
				className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 w-fit"
			>
				<RefreshCw className="size-3.5" />
				{t("retryButton")}
			</button>
		</div>
	);
}
