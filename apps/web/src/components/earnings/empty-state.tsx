"use client";

import { Compass, Trophy, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";

export function WalletNotConnectedEarningsState() {
	const t = useTranslations("Earnings");

	return (
		<div className="rounded-3xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-8 text-center shadow-xl backdrop-blur md:p-12 dark:border-white/10 dark:from-zinc-900/80 dark:to-zinc-950/90 dark:shadow-2xl">
			<div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
				<Wallet className="size-8" />
			</div>

			<h2 className="mt-6 font-serif text-2xl font-bold tracking-tight text-zinc-950 md:text-3xl dark:text-white">
				{t("connectWalletTitle")}
			</h2>
			<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
				{t("connectWalletDesc")}
			</p>

			<div className="mt-8 flex justify-center">
				<WalletConnectButton className="px-6 py-2.5 shadow-lg" />
			</div>
		</div>
	);
}

export function NoEarningsFoundState({
	walletAddress,
}: {
	walletAddress: string;
}) {
	const t = useTranslations("Earnings");

	return (
		<div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-8 text-center backdrop-blur md:p-12 dark:border-white/10 dark:bg-zinc-900/60">
			<div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-zinc-800/50 dark:text-zinc-400">
				<Trophy className="size-8" />
			</div>

			<h2 className="mt-6 font-serif text-2xl font-bold tracking-tight text-zinc-950 md:text-3xl dark:text-white">
				{t("noEarningsTitle")}
			</h2>
			<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
				{t("noEarningsDesc")}
			</p>

			<div className="mt-4 font-mono text-xs text-zinc-500">
				{walletAddress.slice(0, 8)}…{walletAddress.slice(-8)}
			</div>

			<div className="mt-8 flex flex-wrap items-center justify-center gap-4">
				<Link
					href="/participant"
					className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-500"
				>
					<Compass className="size-4" />
					{t("exploreCompetitionsAction")}
				</Link>
				<Link
					href="/my-events"
					className="inline-flex items-center gap-2 rounded-xl border border-zinc-900/15 bg-zinc-900/5 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-900/10 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
				>
					{t("viewMyEventsAction")}
				</Link>
			</div>
		</div>
	);
}
