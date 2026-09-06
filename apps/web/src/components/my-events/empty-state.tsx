"use client";

import { Calendar, Compass, PlusCircle, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";

export function WalletNotConnectedState() {
	const t = useTranslations("MyEvents");

	return (
		<div className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-8 md:p-12 text-center backdrop-blur shadow-2xl">
			<div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
				<Wallet className="size-8" />
			</div>

			<h2 className="mt-6 font-serif text-2xl font-bold tracking-tight text-white md:text-3xl">
				{t("connectWalletTitle")}
			</h2>
			<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
				{t("connectWalletDesc")}
			</p>

			<div className="mt-8 flex justify-center">
				<WalletConnectButton className="bg-white text-black hover:bg-white/90 px-6 py-2.5 font-medium shadow-lg" />
			</div>
		</div>
	);
}

export function NoEventsFoundState({
	walletAddress,
	filterRole,
}: {
	walletAddress: string;
	filterRole?: string;
}) {
	const t = useTranslations("MyEvents");

	return (
		<div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-8 md:p-12 text-center backdrop-blur">
			<div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-zinc-800/50 text-zinc-400">
				<Calendar className="size-8" />
			</div>

			<h2 className="mt-6 font-serif text-2xl font-bold tracking-tight text-white md:text-3xl">
				{t("noEventsTitle")}
			</h2>
			<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
				{filterRole && filterRole !== "ALL"
					? t("noRoleEventsDesc", { role: filterRole.toLowerCase() })
					: t("noEventsDesc")}
			</p>

			<div className="mt-4 font-mono text-xs text-zinc-500">
				{walletAddress.slice(0, 8)}…{walletAddress.slice(-8)}
			</div>

			<div className="mt-8 flex flex-wrap items-center justify-center gap-4">
				<Link
					href="/participant"
					className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-blue-500"
				>
					<Compass className="size-4" />
					{t("browseBountiesAction")}
				</Link>
				<Link
					href="/organizer"
					className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/10"
				>
					<PlusCircle className="size-4" />
					{t("hostEventAction")}
				</Link>
			</div>
		</div>
	);
}
