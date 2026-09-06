"use client";

import {
	Award,
	Check,
	ExternalLink,
	FileText,
	Filter,
	Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { truncateStellarKey } from "@/lib/judge/judge-helpers";
import type { JudgePrize, JudgeSubmission } from "@/lib/judge/types";

interface SubmissionReviewProps {
	prizes: JudgePrize[];
	activePrizeId: string;
	onSelectPrize: (prizeId: string) => void;
	onSelectWinner: (prizeId: string, winnerWallet: string) => void;
	_onScoreUpdate?: (
		prizeId: string,
		submissionId: string,
		score: number,
	) => void;
	className?: string;
}

export function SubmissionReview({
	prizes,
	activePrizeId,
	onSelectPrize,
	onSelectWinner,
	_onScoreUpdate,
	className = "",
}: SubmissionReviewProps) {
	const t = useTranslations("JudgeSubmissionReview");
	const activePrize = prizes.find((p) => p.id === activePrizeId) || prizes[0];
	const [_scoringId, _setScoringId] = useState<string | null>(null);
	const [_tempScore, _setTempScore] = useState<number>(0);

	if (!activePrize) {
		return (
			<div
				className={`rounded-3xl border border-white/10 bg-zinc-900/40 p-8 text-center text-zinc-400 ${className}`}
			>
				<FileText className="size-8 mx-auto text-zinc-600 mb-2" />
				<p>{t("noPrizesFound")}</p>
			</div>
		);
	}

	return (
		<div
			className={`space-y-6 ${className}`}
			data-testid="submission-review-panel"
		>
			{/* Prize Category Tabs */}
			<div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
				<div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mr-2">
					<Filter className="size-3.5" />
					<span>{t("prizesTabLabel")}:</span>
				</div>
				{prizes.map((prize) => {
					const isSelected = prize.id === activePrize.id;
					return (
						<button
							key={prize.id}
							type="button"
							onClick={() => onSelectPrize(prize.id)}
							className={`rounded-xl px-4 py-2 text-xs font-medium transition-all flex items-center gap-2 ${
								isSelected
									? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
									: "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/5"
							}`}
						>
							<Award className="size-3.5" />
							<span>{prize.title}</span>
							<span className="font-mono text-[11px] opacity-80">
								({prize.amount.toLocaleString()} {prize.currency})
							</span>
						</button>
					);
				})}
			</div>

			{/* Submissions Feed */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-bold text-white flex items-center gap-2">
						<FileText className="size-4 text-blue-400" />
						{t("submissionsHeader", { count: activePrize.submissions.length })}
					</h3>
					<span className="text-xs text-zinc-400">
						{activePrize.assignedWinnerWallet ? (
							<span className="text-emerald-400 font-medium">
								{t("winnerAssignedStatus", {
									winner: truncateStellarKey(activePrize.assignedWinnerWallet),
								})}
							</span>
						) : (
							t("winnerPendingStatus")
						)}
					</span>
				</div>

				{activePrize.submissions.length === 0 ? (
					<div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-8 text-center text-xs text-zinc-500">
						{t("emptySubmissions")}
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4">
						{activePrize.submissions.map((sub: JudgeSubmission) => {
							const isAssignedWinner =
								activePrize.assignedWinnerWallet === sub.participantWallet;

							return (
								<div
									key={sub.id}
									className={`rounded-2xl border p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
										isAssignedWinner
											? "border-emerald-500/40 bg-emerald-950/20 ring-1 ring-emerald-500/20"
											: "border-white/10 bg-zinc-900/60 hover:border-white/20"
									}`}
								>
									<div className="space-y-1.5 max-w-xl">
										<div className="flex items-center gap-2">
											<h4 className="font-semibold text-white text-sm">
												{sub.projectTitle}
											</h4>
											{isAssignedWinner && (
												<span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
													<Award className="size-3" />
													{t("winnerBadge")}
												</span>
											)}
										</div>

										<p className="text-xs text-zinc-400 font-mono">
											{t("author")}: {truncateStellarKey(sub.participantWallet)}
										</p>

										{sub.notes && (
											<p className="text-xs text-zinc-300 line-clamp-2 mt-1">
												{sub.notes}
											</p>
										)}

										<div className="flex items-center gap-4 pt-1">
											<a
												href={sub.url}
												target="_blank"
												rel="noreferrer"
												className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
											>
												<span>{t("viewProject")}</span>
												<ExternalLink className="size-3" />
											</a>
											<span className="text-[11px] text-zinc-500 font-mono">
												{new Date(sub.submittedAt).toLocaleDateString()}
											</span>
										</div>
									</div>

									{/* Score & Assign Button */}
									<div className="flex sm:flex-col items-end gap-3 shrink-0">
										<div className="flex items-center gap-1.5 text-xs text-zinc-300">
											<Star className="size-3.5 text-amber-400 fill-amber-400" />
											<span className="font-mono font-semibold">
												{sub.score ? `${sub.score}/100` : t("unrated")}
											</span>
										</div>

										<button
											type="button"
											onClick={() =>
												onSelectWinner(activePrize.id, sub.participantWallet)
											}
											disabled={
												activePrize.status === "APPROVED" ||
												activePrize.status === "RELEASED"
											}
											className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
												isAssignedWinner
													? "bg-emerald-600 text-white hover:bg-emerald-500"
													: "bg-white text-black hover:bg-zinc-200"
											}`}
										>
											{isAssignedWinner ? (
												<>
													<Check className="size-3.5" />
													{t("selectedAsWinner")}
												</>
											) : (
												t("chooseWinnerButton")
											)}
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
