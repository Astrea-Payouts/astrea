import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EventStatusBadge } from "@/components/events/status-badge";
import { TxHashLink } from "@/components/tx-hash-link";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { STELLAR_NETWORK } from "@/lib/stellar-network";
import { isUuid } from "@/lib/uuid";
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
	const event = isUuid(id)
		? await db.event.findUnique({ where: { id }, select: { name: true } })
		: null;
	return { title: event ? `${t("title")} — ${event.name}` : t("title") };
}

export default async function JudgePage({ params }: { params: Params }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const event = await db.event.findUnique({
		where: { id },
		include: {
			prizes: {
				orderBy: { rank: "asc" },
				include: { winnerTeam: { select: { name: true } } },
			},
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
	// After a release the page revalidates into COMPLETED; showing the 403
	// "not in judging" there reads as a failure, so the outcome is shown
	// instead. The hash is public data, same as on the event page.
	const isCompleted = event.status === "COMPLETED";
	const releaseTxHash =
		event.prizes.find((p) => p.releaseTxHash)?.releaseTxHash ?? null;

	return (
		<main className="min-h-screen bg-white dark:bg-black text-zinc-950 dark:text-white pt-28 pb-16 px-4 sm:px-6 md:py-12 md:px-12">
			<div className="mx-auto max-w-3xl flex flex-col gap-6">
				<Link
					href={`/events/${event.id}`}
					className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
				>
					← {event.name}
				</Link>
				<header className="flex flex-col gap-3">
					<EventStatusBadge status={event.status} className="w-fit" />
					<h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
						{t("title")}
					</h1>
				</header>

				{isCompleted ? (
					<section
						className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex flex-col gap-3"
						role="status"
					>
						<p className="font-semibold text-emerald-700 dark:text-emerald-300">
							{t("done.title")}
						</p>
						<p className="text-sm text-zinc-700 dark:text-zinc-300">
							{t("done.hint")}
						</p>
						<ul className="divide-y divide-zinc-200 dark:divide-white/10 text-sm">
							{event.prizes.map((prize) => (
								<li
									key={prize.rank}
									className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between"
								>
									<span>
										{t("rank", { rank: prize.rank })}{" "}
										<span className="font-mono text-zinc-600 dark:text-zinc-400">
											{prize.amount.toString()} {env.USDC_SYMBOL}
										</span>
									</span>
									<span className="text-zinc-700 dark:text-zinc-300">
										{t("done.winner", {
											team: prize.winnerTeam?.name ?? "—",
										})}
									</span>
								</li>
							))}
						</ul>
						{releaseTxHash ? (
							<div className="break-all">
								<TxHashLink
									hash={releaseTxHash}
									network={STELLAR_NETWORK}
									leadingChars={10}
									trailingChars={10}
								/>
							</div>
						) : null}
						<Link
							href={`/events/${event.id}`}
							className="text-sm text-zinc-600 dark:text-zinc-400 underline-offset-4 hover:underline w-fit"
						>
							{t("done.backToEvent")}
						</Link>
					</section>
				) : !session ? (
					<section className="rounded-2xl border border-zinc-200 dark:border-white/10 p-5 flex flex-col gap-3">
						<p className="text-sm text-zinc-700 dark:text-zinc-300">
							{t("connect")}
						</p>
						<WalletConnectButton className="w-full sm:w-auto" />
					</section>
				) : !isJudge || !isJudging ? (
					<section
						className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex flex-col gap-2"
						role="alert"
					>
						<p className="font-mono text-xs text-red-700 dark:text-red-300">
							403
						</p>
						<p className="text-sm text-red-800 dark:text-red-200">
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
