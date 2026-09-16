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
import { getSessionWallet } from "@/lib/wallet/session";
import { failure } from "../action-result";
import { ServiceFailure, OrganizerShell as Shell } from "../shell";
import { FundAndCreate } from "./fund-and-create";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

async function loadEvent(id: string) {
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
	const event = await db.event.findUnique({
		where: { id },
		select: { name: true },
	});
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
				<section className="rounded-2xl border border-emerald-500/20 bg-zinc-900/40 p-5 flex flex-col gap-3">
					<p className="text-sm text-zinc-300">{t("connect")}</p>
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
					className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 break-words"
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
			<section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 flex flex-col gap-3">
				<h2 className="text-sm font-semibold text-zinc-400">
					{t("prizes.title")}
				</h2>
				<ul className="divide-y divide-white/10 text-sm">
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
