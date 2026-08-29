"use client";

import {
	ArrowUpDown,
	Award,
	Calendar,
	Coins,
	Search,
	ShieldCheck,
	Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TxHashLink } from "@/components/tx-hash-link";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";
import {
	calculateEarningsSummary,
	DEMO_PARTICIPANT_EARNINGS,
	type ParticipantEarningsItem,
} from "@/lib/earnings";
import { useWallet } from "@/lib/wallet/provider";

export default function EarningsPage() {
	const t = useTranslations("EarningsPage");
	const { address } = useWallet();
	const [searchQuery, setSearchQuery] = useState("");
	const [networkFilter, setNetworkFilter] = useState<
		"all" | "testnet" | "mainnet"
	>("all");
	const [sortBy, setSortBy] = useState<
		"newest" | "oldest" | "amount_desc" | "amount_asc"
	>("newest");

	const [payouts] = useState<ParticipantEarningsItem[]>(
		DEMO_PARTICIPANT_EARNINGS,
	);

	const summary = useMemo(() => calculateEarningsSummary(payouts), [payouts]);

	const filteredPayouts = useMemo(() => {
		return payouts
			.filter((item) => {
				const matchesSearch = item.eventName
					.toLowerCase()
					.includes(searchQuery.toLowerCase());
				const matchesNetwork =
					networkFilter === "all" || item.network === networkFilter;
				return matchesSearch && matchesNetwork;
			})
			.sort((a, b) => {
				if (sortBy === "newest") {
					return (
						new Date(b.confirmedAt).getTime() -
						new Date(a.confirmedAt).getTime()
					);
				}
				if (sortBy === "oldest") {
					return (
						new Date(a.confirmedAt).getTime() -
						new Date(b.confirmedAt).getTime()
					);
				}
				if (sortBy === "amount_desc") {
					return b.amountUsdc - a.amountUsdc;
				}
				if (sortBy === "amount_asc") {
					return a.amountUsdc - b.amountUsdc;
				}
				return 0;
			});
	}, [payouts, searchQuery, networkFilter, sortBy]);

	return (
		<main className="min-h-screen bg-black text-white px-6 py-16 md:px-12">
			<div className="max-w-5xl mx-auto space-y-8">
				{/* Top Header */}
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-zinc-800/80">
					<div>
						<div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-emerald-400 uppercase mb-2">
							<ShieldCheck className="w-4 h-4" />
							<span>{t("badge")}</span>
						</div>
						<h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">
							{t("title")}
						</h1>
						<p className="text-sm text-zinc-400 mt-1 max-w-xl">
							{t("subtitle")}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<WalletConnectButton className="bg-white text-black hover:bg-zinc-200" />
					</div>
				</div>

				{/* Summary Metrics Cards */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 shadow-sm space-y-2">
						<div className="flex items-center justify-between text-zinc-400">
							<span className="text-xs font-medium uppercase tracking-wider">
								{t("totalEarned")}
							</span>
							<Coins className="w-4 h-4 text-emerald-400" />
						</div>
						<div className="text-2xl md:text-3xl font-mono font-bold text-emerald-400">
							$
							{summary.totalEarnedUsdc.toLocaleString("en-US", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}{" "}
							<span className="text-xs font-sans text-emerald-500 font-normal">
								USDC
							</span>
						</div>
						<p className="text-[11px] text-zinc-500">{t("totalEarnedDesc")}</p>
					</div>

					<div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 shadow-sm space-y-2">
						<div className="flex items-center justify-between text-zinc-400">
							<span className="text-xs font-medium uppercase tracking-wider">
								{t("totalPayouts")}
							</span>
							<Award className="w-4 h-4 text-indigo-400" />
						</div>
						<div className="text-2xl md:text-3xl font-mono font-bold text-white">
							{summary.totalPayoutsCount}
						</div>
						<p className="text-[11px] text-zinc-500">{t("totalPayoutsDesc")}</p>
					</div>

					<div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 shadow-sm space-y-2">
						<div className="flex items-center justify-between text-zinc-400">
							<span className="text-xs font-medium uppercase tracking-wider">
								{t("eventsWon")}
							</span>
							<Trophy className="w-4 h-4 text-amber-400" />
						</div>
						<div className="text-2xl md:text-3xl font-mono font-bold text-white">
							{summary.distinctEventsCount}
						</div>
						<p className="text-[11px] text-zinc-500">{t("eventsWonDesc")}</p>
					</div>

					<div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 shadow-sm space-y-2">
						<div className="flex items-center justify-between text-zinc-400">
							<span className="text-xs font-medium uppercase tracking-wider">
								{t("latestPayout")}
							</span>
							<Calendar className="w-4 h-4 text-purple-400" />
						</div>
						<div className="text-sm font-medium text-zinc-200 mt-1">
							{summary.latestPayoutDate
								? new Date(summary.latestPayoutDate).toLocaleDateString(
										"en-US",
										{
											year: "numeric",
											month: "short",
											day: "numeric",
										},
									)
								: "—"}
						</div>
						<p className="text-[11px] text-zinc-500">{t("latestPayoutDesc")}</p>
					</div>
				</div>

				{/* Search & Filter Toolbar */}
				<div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
						<input
							type="text"
							placeholder={t("searchPlaceholder")}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-lg p-0.5 text-xs">
							<button
								type="button"
								onClick={() => setNetworkFilter("all")}
								className={`px-2.5 py-1 rounded-md capitalize transition-all ${
									networkFilter === "all"
										? "bg-zinc-800 text-white font-medium shadow-xs"
										: "text-zinc-400 hover:text-zinc-200"
								}`}
							>
								{t("all")}
							</button>
							<button
								type="button"
								onClick={() => setNetworkFilter("testnet")}
								className={`px-2.5 py-1 rounded-md capitalize transition-all ${
									networkFilter === "testnet"
										? "bg-zinc-800 text-white font-medium shadow-xs"
										: "text-zinc-400 hover:text-zinc-200"
								}`}
							>
								{t("testnet")}
							</button>
							<button
								type="button"
								onClick={() => setNetworkFilter("mainnet")}
								className={`px-2.5 py-1 rounded-md capitalize transition-all ${
									networkFilter === "mainnet"
										? "bg-zinc-800 text-white font-medium shadow-xs"
										: "text-zinc-400 hover:text-zinc-200"
								}`}
							>
								{t("mainnet")}
							</button>
						</div>

						<div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-lg px-2 py-1 text-xs">
							<ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
							<select
								value={sortBy}
								onChange={(e) =>
									setSortBy(
										e.target.value as
											| "newest"
											| "oldest"
											| "amount_desc"
											| "amount_asc",
									)
								}
								className="bg-transparent text-zinc-300 focus:outline-none text-xs cursor-pointer"
							>
								<option value="newest" className="bg-zinc-900 text-white">
									{t("newest")}
								</option>
								<option value="oldest" className="bg-zinc-900 text-white">
									{t("oldest")}
								</option>
								<option value="amount_desc" className="bg-zinc-900 text-white">
									{t("highest")}
								</option>
								<option value="amount_asc" className="bg-zinc-900 text-white">
									{t("lowest")}
								</option>
							</select>
						</div>
					</div>
				</div>

				{/* Payouts Table / List */}
				{filteredPayouts.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 text-center">
						<Trophy className="w-10 h-10 text-zinc-600 mb-3" />
						<h3 className="text-base font-semibold text-zinc-300">
							{t("noEarningsTitle")}
						</h3>
						<p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4">
							{address
								? t("noEarningsDescConnected")
								: t("noEarningsDescDisconnected")}
						</p>
						<Link
							href="/"
							className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
						>
							{t("exploreCta")}
						</Link>
					</div>
				) : (
					<div className="space-y-3">
						{filteredPayouts.map((payout) => (
							<div
								key={payout.id}
								className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700/80 transition-all shadow-md group"
							>
								<div className="space-y-2 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide border bg-emerald-950/50 text-emerald-300 border-emerald-800/60">
											<Award className="w-3 h-3" />
											<span>{t("rank", { rank: payout.prizeRank })}</span>
										</span>
										<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide border bg-zinc-900 text-zinc-400 border-zinc-800 uppercase">
											<span>{payout.network}</span>
										</span>
										<span className="text-xs text-zinc-500 flex items-center gap-1">
											<Calendar className="w-3 h-3" />
											<span>
												{new Date(payout.confirmedAt).toLocaleDateString(
													"en-US",
													{
														year: "numeric",
														month: "short",
														day: "numeric",
														hour: "2-digit",
														minute: "2-digit",
													},
												)}
											</span>
										</span>
									</div>

									<h2 className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors">
										<Link
											href={`/events/${payout.eventId}`}
											className="hover:underline underline-offset-4"
										>
											{payout.eventName}
										</Link>
									</h2>

									<div className="flex items-center gap-2 pt-1 text-xs">
										<span className="text-zinc-500 font-mono">TX:</span>
										<TxHashLink hash={payout.txHash} network={payout.network} />
									</div>
								</div>

								{/* Amount Badge */}
								<div className="flex flex-col md:items-end justify-center pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800/60">
									<div className="text-xl md:text-2xl font-mono font-bold text-emerald-400">
										+${payout.amountFormatted}
									</div>
									<span className="text-[11px] text-zinc-500 uppercase tracking-wider">
										{t("directPayout")}
									</span>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</main>
	);
}
