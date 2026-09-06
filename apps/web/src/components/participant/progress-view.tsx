"use client";

import {
	CheckCircle2,
	CircleDot,
	Clock,
	ExternalLink,
	Sparkles,
	Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { truncateStellarKey } from "@/lib/participant/participant-helpers";
import type {
	ParticipantSubmission,
	UsdcTrustlineState,
} from "@/lib/participant/types";

interface ProgressViewProps {
	walletAddress?: string | null;
	isRegistered: boolean;
	trustlineStatus: UsdcTrustlineState;
	submission?: ParticipantSubmission | null;
	eventStatus:
		| "CREATED"
		| "FUNDED"
		| "LIVE"
		| "JUDGING"
		| "COMPLETED"
		| "CANCELLED";
	className?: string;
}

export function ParticipantProgressView({
	walletAddress,
	isRegistered,
	trustlineStatus,
	submission,
	eventStatus,
	className = "",
}: ProgressViewProps) {
	const t = useTranslations("ParticipantProgress");

	const steps = [
		{
			id: "wallet",
			title: t("stepWalletTitle"),
			desc: walletAddress
				? truncateStellarKey(walletAddress)
				: t("stepWalletPending"),
			isDone: Boolean(walletAddress),
			isActive: !walletAddress,
		},
		{
			id: "registration",
			title: t("stepRegTitle"),
			desc: isRegistered ? t("stepRegDone") : t("stepRegPending"),
			isDone: isRegistered,
			isActive: Boolean(walletAddress) && !isRegistered,
		},
		{
			id: "trustline",
			title: t("stepTrustlineTitle"),
			desc:
				trustlineStatus === "ACTIVE"
					? t("stepTrustlineActive")
					: trustlineStatus === "MISSING"
						? t("stepTrustlineMissing")
						: t("stepTrustlinePending"),
			isDone: trustlineStatus === "ACTIVE",
			isActive: isRegistered && trustlineStatus !== "ACTIVE",
		},
		{
			id: "submission",
			title: t("stepSubTitle"),
			desc: submission ? t("stepSubDone") : t("stepSubPending"),
			isDone: Boolean(submission),
			isActive: isRegistered && trustlineStatus === "ACTIVE" && !submission,
			url: submission?.url,
		},
		{
			id: "judging",
			title: t("stepJudgingTitle"),
			desc:
				eventStatus === "COMPLETED"
					? t("stepJudgingCompleted")
					: eventStatus === "JUDGING"
						? t("stepJudgingActive")
						: t("stepJudgingPending"),
			isDone: eventStatus === "COMPLETED",
			isActive: eventStatus === "JUDGING",
		},
	];

	return (
		<div
			className={`rounded-3xl border border-white/10 bg-zinc-900/50 p-6 sm:p-8 backdrop-blur ${className}`}
			data-testid="participant-progress-view"
		>
			<div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
				<div>
					<h3 className="text-lg font-bold text-white flex items-center gap-2">
						<Sparkles className="size-4 text-blue-400" />
						{t("title")}
					</h3>
					<p className="text-xs text-zinc-400 mt-1">{t("subtitle")}</p>
				</div>
				<div className="flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-xs font-semibold text-blue-400">
					<Trophy className="size-3.5" />
					<span>{eventStatus}</span>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
				{steps.map((step, idx) => {
					let icon = <CircleDot className="size-5 text-zinc-600" />;
					let statusColor = "border-white/10 bg-black/30";
					let titleColor = "text-zinc-500";

					if (step.isDone) {
						icon = <CheckCircle2 className="size-5 text-emerald-400" />;
						statusColor = "border-emerald-500/30 bg-emerald-950/20";
						titleColor = "text-white";
					} else if (step.isActive) {
						icon = <Clock className="size-5 text-blue-400 animate-pulse" />;
						statusColor =
							"border-blue-500/40 bg-blue-950/30 ring-1 ring-blue-500/30";
						titleColor = "text-blue-300";
					}

					return (
						<div
							key={step.id}
							className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all ${statusColor}`}
						>
							<div>
								<div className="flex items-center justify-between mb-2">
									<span className="text-[10px] font-mono text-zinc-500 uppercase">
										0{idx + 1}
									</span>
									{icon}
								</div>
								<h5 className={`text-xs font-semibold ${titleColor}`}>
									{step.title}
								</h5>
								<p className="text-[11px] text-zinc-400 mt-1 truncate">
									{step.desc}
								</p>
							</div>

							{step.url && (
								<a
									href={step.url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors mt-1 truncate"
								>
									<span>{t("viewEntry")}</span>
									<ExternalLink className="size-3 shrink-0" />
								</a>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
