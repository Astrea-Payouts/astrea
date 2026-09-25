import { ChevronRight, Coins } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EarningsDashboard } from "@/components/earnings/earnings-dashboard";
import { Link } from "@/i18n/navigation";
import { getParticipantEarnings } from "@/lib/earnings/query";
import { getSessionWallet } from "@/lib/wallet/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "Earnings" });

	return {
		title: `${t("pageTitle")} — Astrea`,
		description: t("pageSubtitle"),
	};
}

export default async function EarningsPage() {
	const t = await getTranslations("Earnings");
	const sessionWallet = await getSessionWallet();
	const walletId = sessionWallet?.id ?? null;
	const walletAddress = sessionWallet?.address ?? null;

	// Fetch confirmed on-chain payouts for this verified wallet.
	// Unauthenticated sessions resolve []. The query itself never throws for
	// auth/db failures, but the belt-and-suspenders catch below guarantees a
	// mid-request session failure renders the empty state — never sample data.
	let earnings: Awaited<ReturnType<typeof getParticipantEarnings>> = [];
	if (walletId) {
		try {
			earnings = await getParticipantEarnings(walletId);
		} catch (err) {
			console.warn(
				"[earnings] page-level query failure, rendering empty state:",
				err,
			);
			earnings = [];
		}
	}

	return (
		<main className="min-h-screen bg-white px-6 pt-28 pb-16 text-zinc-950 md:px-12 md:py-12 dark:bg-black dark:text-white">
			<div className="mx-auto max-w-6xl">
				{/* Breadcrumb Navigation */}
				<nav
					aria-label="Breadcrumb"
					className="mb-8 flex items-center gap-2 text-xs text-zinc-500"
				>
					<Link
						href="/"
						className="transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
					>
						{t("breadcrumbHome")}
					</Link>
					<ChevronRight className="size-3 text-zinc-400 dark:text-zinc-600" />
					<span className="font-medium text-zinc-700 dark:text-zinc-300">
						{t("breadcrumbEarnings")}
					</span>
				</nav>

				{/* Header Section */}
				<div className="mb-10">
					<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
						<Coins className="size-3.5" />
						<span>{t("portalBadge")}</span>
					</div>

					<h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-zinc-950 md:text-5xl dark:text-white">
						{t("pageTitle")}
					</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 md:text-base dark:text-zinc-400">
						{t("pageSubtitle")}
					</p>
				</div>

				{/* Interactive Earnings Dashboard */}
				<EarningsDashboard
					initialEarnings={earnings}
					sessionWalletAddress={walletAddress}
				/>
			</div>
		</main>
	);
}
