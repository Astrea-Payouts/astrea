import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { redirect } from "@/i18n/navigation";
import { walletBalance } from "@/lib/core-go/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sumUsdcAmounts } from "@/lib/escrow/amount";
import { formatSmallestUnits } from "@/lib/explorer";
import { isUuid } from "@/lib/uuid";
import { getSessionWallet } from "@/lib/wallet/session";
import { failure } from "../action-result";
import { ServiceFailure, OrganizerShell as Shell } from "../shell";
import { FundAndCreate } from "./fund-and-create";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

async function loadEvent(id: string) {
	if (!isUuid(id)) return null;
	return db.event.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			status: true,
			organizerWallet: { select: { address: true } },
			prizes: {
				orderBy: { rank: "asc" },
				select: { rank: true, amount: true },
			},
		},
	});
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { id } = await params;
	const t = await getTranslations("FundPage");
	const event = isUuid(id)
		? await db.event.findUnique({ where: { id }, select: { name: true } })
		: null;
	return { title: event ? `${t("title")} — ${event.name}` : t("title") };
}

// Step 2 of the organizer path (#15 PR B1): the organizer's wallet tops up
// its USDC balance in the escrow contract, then signs create_event. Both
// transactions are built by Go right before signing (60 s timebound).
export default async function FundPage({ params }: { params: Params }) {
	const { id } = await params;
	const event = await loadEvent(id);
	if (!event) notFound();

	// Only a DRAFT can be funded and created; anything else already has a
	// public page that says what it is.
	if (event.status !== "DRAFT") {
		redirect({ href: `/events/${event.id}`, locale: await getLocale() });
	}

	const t = await getTranslations("FundPage");
	const session = await getSessionWallet();
	const symbol = env.USDC_SYMBOL;

	if (!session) {
		return (
			<Shell title={t("title")} event={event}>
				<section className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-zinc-50/80 p-5 dark:bg-zinc-900/40">
					<p className="text-sm text-zinc-700 dark:text-zinc-300">
						{t("connect")}
					</p>
					<WalletConnectButton className="w-full sm:w-auto" />
				</section>
			</Shell>
		);
	}

	if (session.address !== event.organizerWallet.address) {
		return (
			<Shell title={t("title")} event={event}>
				<p
					role="alert"
					className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm break-words text-red-700 dark:text-red-300"
				>
					<span className="font-mono text-xs">403</span>{" "}
					{t("forbidden.notOrganizer")}
				</p>
			</Shell>
		);
	}

	// Display-side sum of the Prize rows. Go's create/build returns its own
	// `reward`; the client refuses to sign if the two differ.
	const prizes = event.prizes.map((p) => ({
		rank: p.rank,
		amount: p.amount.toString(),
	}));
	const required = sumUsdcAmounts(prizes.map((p) => p.amount)).toString();

	const read = await walletBalance(session.address, session.address).then(
		(res) => ({ ok: true as const, balance: res.balance }),
		(err: unknown) => failure(err),
	);

	return (
		<Shell title={t("title")} event={event}>
			<section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-zinc-900/60">
				<h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
					{t("prizes.title")}
				</h2>
				<ul className="divide-y divide-zinc-200 text-sm dark:divide-white/10">
					{prizes.map((prize) => (
						<li
							key={prize.rank}
							className="flex items-center justify-between py-2"
						>
							<span>{t("prizes.rank", { rank: prize.rank })}</span>
							<span className="font-mono">
								{prize.amount} {symbol}
							</span>
						</li>
					))}
				</ul>
				<p className="flex items-center justify-between text-sm font-semibold">
					<span>{t("prizes.total")}</span>
					<span className="font-mono">
						{formatSmallestUnits(required)} {symbol}
					</span>
				</p>
			</section>

			{!read.ok ? (
				<ServiceFailure label={t("balanceFailed")} failure={read} />
			) : (
				<FundAndCreate
					eventId={event.id}
					address={session.address}
					initialBalance={read.balance}
					required={required}
					symbol={symbol}
				/>
			)}
		</Shell>
	);
}
