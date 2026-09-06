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
	const walletAddress =
		sessionWallet?.address ??
		"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

	// Fetch confirmed on-chain payouts for this wallet
	const earnings = await getParticipantEarnings(walletAddress);

	return (
		<main className="min-h-screen bg-black text-white py-12 px-6 md:px-12">
			<div className="mx-auto max-w-6xl">
				{/* Breadcrumb Navigation */}
				<nav
					aria-label="Breadcrumb"
					className="flex items-center gap-2 text-xs text-zinc-500 mb-8"
				>
					<Link href="/" className="transition-colors hover:text-zinc-300">
						{t("breadcrumbHome")}
					</Link>
					<ChevronRight className="size-3 text-zinc-600" />
					<span className="font-medium text-zinc-300">
						{t("breadcrumbEarnings")}
					</span>
				</nav>

				{/* Header Section */}
				<div className="mb-10">
					<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
						<Coins className="size-3.5" />
						<span>{t("portalBadge")}</span>
					</div>

					<h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-white md:text-5xl">
						{t("pageTitle")}
					</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
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
