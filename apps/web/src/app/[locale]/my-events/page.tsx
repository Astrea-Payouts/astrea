import { Calendar, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MyEventsDashboard } from "@/components/my-events/my-events-dashboard";
import { Link } from "@/i18n/navigation";
import { getMyEvents } from "@/lib/my-events/query";
import { getSessionWallet } from "@/lib/wallet/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "MyEvents" });

	return {
		title: `${t("pageTitle")} — Astrea`,
		description: t("pageSubtitle"),
	};
}

export default async function MyEventsPage() {
	const t = await getTranslations("MyEvents");
	const sessionWallet = await getSessionWallet();
	const walletAddress =
		sessionWallet?.address ??
		"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

	// Fetch events associated with this wallet (or fallback sample data)
	const events = await getMyEvents(walletAddress);

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
						{t("breadcrumbMyEvents")}
					</span>
				</nav>

				{/* Header Section */}
				<div className="mb-10">
					<div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
						<Calendar className="size-3.5" />
						<span>{t("portalBadge")}</span>
					</div>

					<h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-white md:text-5xl">
						{t("pageTitle")}
					</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
						{t("pageSubtitle")}
					</p>
				</div>

				{/* Interactive Dashboard with Live Countdowns */}
				<MyEventsDashboard
					initialEvents={events}
					sessionWalletAddress={walletAddress}
				/>
			</div>
		</main>
	);
}
