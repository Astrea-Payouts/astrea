"use client";

import {
	ArrowUpDown,
	Award,
	CheckCircle2,
	Coins,
	ExternalLink,
	Medal,
	Search,
	ShieldCheck,
	Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
	NoEarningsFoundState,
	WalletNotConnectedEarningsState,
} from "@/components/earnings/empty-state";
import { TxHashLink } from "@/components/tx-hash-link";
import { Link } from "@/i18n/navigation";
import {
	calculateEarningsSummary,
	filterAndSortEarnings,
	formatPayoutDate,
} from "@/lib/earnings/summary";
import type { EarningsItem, EarningsSortOption } from "@/lib/earnings/types";
import { useWallet } from "@/lib/wallet/provider";

interface EarningsDashboardProps {
	initialEarnings: EarningsItem[];
	sessionWalletAddress: string | null;
}

export function EarningsDashboard({
	initialEarnings,
	sessionWalletAddress,
}: EarningsDashboardProps) {
	const t = useTranslations("Earnings");
	const { address: connectedAddress } = useWallet();

	const activeAddress = connectedAddress || sessionWalletAddress;

	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<EarningsSortOption>("date-desc");

	const summary = useMemo(
		() => calculateEarningsSummary(initialEarnings),
		[initialEarnings],
	);

	const filteredEarnings = useMemo(() => {
		return filterAndSortEarnings(initialEarnings, { searchQuery, sortBy });
	}, [initialEarnings, searchQuery, sortBy]);

	if (!activeAddress) {
		return <WalletNotConnectedEarningsState />;
	}

	return (
		<div className="space-y-8">
			{/* Top Summary Metrics */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
					<div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							{t("metricTotalEarnings")}
						</span>
						<Coins className="size-4 text-emerald-700 dark:text-emerald-400" />
					</div>
					<div className="mt-3 text-3xl font-bold text-emerald-700 dark:text-emerald-400">
						${summary.totalUsdc}
					</div>
					<div className="mt-1 text-xs text-zinc-500">
						{t("metricTotalDesc")}
					</div>
				</div>

				<div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
					<div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							{t("metricEventsWon")}
						</span>
						<Trophy className="size-4 text-amber-600 dark:text-amber-400" />
					</div>
					<div className="mt-3 text-3xl font-bold text-zinc-950 dark:text-white">
						{summary.totalEventsCount}
					</div>
					<div className="mt-1 text-xs text-zinc-500">
						{t("metricEventsDesc")}
					</div>
				</div>

				<div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
					<div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							{t("metricPrizesWon")}
						</span>
						<Medal className="size-4 text-blue-700 dark:text-blue-400" />
					</div>
					<div className="mt-3 text-3xl font-bold text-zinc-950 dark:text-white">
						{summary.totalPrizesCount}
					</div>
					<div className="mt-1 text-xs text-zinc-500">
						{t("metricPrizesDesc")}
					</div>
				</div>

				<div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
					<div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							{t("metricAveragePayout")}
						</span>
						<Award className="size-4 text-purple-700 dark:text-purple-400" />
					</div>
					<div className="mt-3 text-3xl font-bold text-zinc-950 dark:text-white">
						${summary.averageUsdc}
					</div>
					<div className="mt-1 text-xs text-zinc-500">{t("metricAvgDesc")}</div>
				</div>
			</div>

			{/* Search & Sort Filter Bar */}
			<div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-zinc-900/40">
				<div className="relative flex-1 sm:max-w-md">
					<Search className="absolute top-2.5 left-3 size-4 text-zinc-500" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={t("searchPlaceholder")}
						className="w-full rounded-xl border border-zinc-200 bg-white py-1.5 pr-3 pl-9 text-xs text-zinc-950 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white"
					/>
				</div>

				<div className="flex items-center gap-3">
					<span className="text-xs text-zinc-500">
						{t("payoutsCount", { count: filteredEarnings.length })}
					</span>

					<div className="relative flex items-center">
						<ArrowUpDown className="pointer-events-none absolute left-3 size-3 text-zinc-500" />
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as EarningsSortOption)}
							className="cursor-pointer rounded-xl border border-zinc-200 bg-white py-1.5 pr-3 pl-8 text-xs text-zinc-700 focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-zinc-300"
						>
							<option value="date-desc">{t("sortNewest")}</option>
							<option value="date-asc">{t("sortOldest")}</option>
							<option value="amount-desc">{t("sortHighest")}</option>
							<option value="amount-asc">{t("sortLowest")}</option>
						</select>
					</div>
				</div>
			</div>

			{/* Payouts List */}
			{filteredEarnings.length === 0 ? (
				<NoEarningsFoundState walletAddress={activeAddress} />
			) : (
				<div className="space-y-4">
					{filteredEarnings.map((item) => (
						<PayoutRow key={item.id} item={item} />
					))}
				</div>
			)}

			{/* Non-Custodial Guarantee Footnote */}
			<div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4 text-xs text-zinc-600 dark:bg-emerald-950/20 dark:text-zinc-400">
				<ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
				<div>
					<span className="font-semibold text-zinc-950 dark:text-white">
						{t("guaranteeTitle")}:
					</span>{" "}
					{t("guaranteeDesc")}
				</div>
			</div>
		</div>
	);
}

function PayoutRow({ item }: { item: EarningsItem }) {
	const t = useTranslations("Earnings");

	return (
		<div className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur transition-all hover:border-zinc-300 sm:flex-row sm:items-center dark:border-white/10 dark:bg-zinc-900/60 dark:hover:border-white/20">
			{/* Left Details: Rank, Event, Date */}
			<div className="flex items-start gap-4">
				<RankBadge rank={item.prizeRank} />

				<div>
					<div className="flex items-center gap-2">
						<Link
							href={`/events/${item.eventId}`}
							className="flex items-center gap-1.5 font-serif text-base font-bold text-zinc-950 transition-colors hover:text-emerald-700 dark:text-white dark:hover:text-emerald-400"
						>
							{item.eventName}
							<ExternalLink className="size-3 text-zinc-500" />
						</Link>
					</div>

					<div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
						<span>{formatPayoutDate(item.confirmedAt)}</span>
						<span>•</span>
						<span>{t("milestoneTag", { index: item.prizeRank })}</span>
						<span>•</span>
						<span className="inline-flex items-center gap-1 font-medium text-emerald-700/90 dark:text-emerald-400/90">
							<CheckCircle2 className="size-3 text-emerald-700 dark:text-emerald-400" />
							{t("confirmedStatus")}
						</span>
					</div>
				</div>
			</div>

			{/* Right Details: Amount & On-Chain Proof */}
			<div className="flex flex-row items-center justify-between gap-6 border-t border-zinc-200 pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0 dark:border-white/5">
				<div className="flex items-baseline gap-1.5">
					<span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400">
						${item.amountUsdc}
					</span>
					<span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
						USDC
					</span>
				</div>

				<div className="flex items-center gap-1.5">
					<span className="font-sans text-[11px] text-zinc-500">
						{t("txProof")}:
					</span>
					<TxHashLink
						hash={item.txHash}
						network={item.network}
						leadingChars={6}
						trailingChars={6}
						showCopy={true}
						showExplorerIcon={true}
						className="text-xs text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
					/>
				</div>
			</div>
		</div>
	);
}

function RankBadge({ rank }: { rank: number }) {
	if (rank === 1) {
		return (
			<div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 shadow-sm dark:text-amber-400">
				<Trophy className="size-5" />
			</div>
		);
	}

	if (rank === 2) {
		return (
			<div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-zinc-400/30 bg-zinc-400/10 text-zinc-600 shadow-sm dark:text-zinc-300">
				<Award className="size-5" />
			</div>
		);
	}

	if (rank === 3) {
		return (
			<div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-700/30 bg-amber-700/10 text-amber-700 shadow-sm dark:text-amber-500">
				<Medal className="size-5" />
			</div>
		);
	}

	return (
		<div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
			#{rank}
		</div>
	);
}
