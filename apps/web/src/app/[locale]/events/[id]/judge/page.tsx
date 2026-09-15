import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EventStatusBadge } from "@/components/events/status-badge";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionWallet } from "@/lib/wallet/session";
import { ReleaseForm } from "./release-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { locale, id } = await params;
	const t = await getTranslations({ locale, namespace: "JudgePage" });
	const event = await db.event.findUnique({
		where: { id },
		select: { name: true },
	});
	return { title: event ? `${t("title")} — ${event.name}` : t("title") };
}

export default async function JudgePage({ params }: { params: Params }) {
	const { id } = await params;
	const event = await db.event.findUnique({
		where: { id },
		include: {
			prizes: { orderBy: { rank: "asc" } },
			judges: { where: { status: "ACTIVE" } },
			teams: {
				orderBy: { createdAt: "asc" },
				select: { id: true, name: true },
			},
		},
	});
	if (!event) notFound();

	const t = await getTranslations("JudgePage");
	const session = await getSessionWallet();

	// Go re-checks both on /release/build; this gate just keeps the form off
	// the screen for anyone it would refuse.
	const judge = event.judges.length === 1 ? event.judges[0] : null;
	const isJudge = !!session && judge?.walletAddress === session.address;
	const isJudging = event.status === "JUDGING";

	return (
		<main className="min-h-screen bg-black text-white pt-28 pb-16 px-4 sm:px-6 md:py-12 md:px-12">
			<div className="mx-auto max-w-3xl flex flex-col gap-6">
				<Link
					href={`/events/${event.id}`}
					className="text-xs text-zinc-500 hover:text-zinc-300"
				>
					← {event.name}
				</Link>
				<header className="flex flex-col gap-3">
					<EventStatusBadge status={event.status} className="w-fit" />
					<h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
						{t("title")}
					</h1>
				</header>

				{!session ? (
					<section className="rounded-2xl border border-white/10 p-5 flex flex-col gap-3">
						<p className="text-sm text-zinc-300">{t("connect")}</p>
						<WalletConnectButton className="w-full sm:w-auto" />
					</section>
				) : !isJudge || !isJudging ? (
					<section
						className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex flex-col gap-2"
						role="alert"
					>
						<p className="font-mono text-xs text-red-300">403</p>
						<p className="text-sm text-red-200">
							{!isJudge ? t("forbidden.notJudge") : t("forbidden.notJudging")}
						</p>
					</section>
				) : (
					<ReleaseForm
						eventId={event.id}
						judgeAddress={session.address}
						prizes={event.prizes.map((p) => ({
							rank: p.rank,
							amount: p.amount.toString(),
						}))}
						teams={event.teams}
						symbol={env.USDC_SYMBOL}
					/>
				)}
			</div>
		</main>
	);
}
