import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { redirect } from "@/i18n/navigation";
import { startQuote } from "@/lib/core-go/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionWallet } from "@/lib/wallet/session";
import { failure } from "../action-result";
import { ServiceFailure, OrganizerShell as Shell } from "../shell";
import { GoLive } from "./go-live";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

async function loadEvent(id: string) {
	return db.event.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			status: true,
			timezone: true,
			judgingDeadlineAt: true,
			organizerWallet: { select: { address: true } },
		},
	});
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { id } = await params;
	const t = await getTranslations("GoLivePage");
	const event = await db.event.findUnique({
		where: { id },
		select: { name: true },
	});
	return { title: event ? `${t("title")} — ${event.name}` : t("title") };
}

// Step 3 of the organizer path (#15 PR B2): the organizer pays the go-live
// fee out of their escrow balance and signs set_event_in_progress. Go's
// /start/submit is the only writer of LIVE; this page never sets status.
export default async function StartPage({ params }: { params: Params }) {
	const { id } = await params;
	const event = await loadEvent(id);
	if (!event) notFound();

	const locale = await getLocale();
	// Only a CREATED event can go live; anything else already has a public
	// page that says what it is.
	if (event.status !== "CREATED") {
		redirect({ href: `/events/${event.id}`, locale });
	}

	const t = await getTranslations("GoLivePage");
	const session = await getSessionWallet();

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

	// Not the organizer: nothing here for them, the public page is.
	if (session.address !== event.organizerWallet.address) {
		redirect({ href: `/events/${event.id}`, locale });
	}

	const quote = await startQuote(event.id, session.address).then(
		(res) => ({ ok: true as const, ...res }),
		(err: unknown) => failure(err),
	);

	// Rendered in the event's own timezone (the one the organizer picked),
	// on the server so the client component never formats a date itself.
	const judgingDeadline = event.judgingDeadlineAt
		? new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: event.timezone,
			}).format(event.judgingDeadlineAt)
		: null;

	return (
		<Shell title={t("title")} event={event}>
			{!quote.ok ? (
				<ServiceFailure label={t("quoteFailed")} failure={quote} />
			) : (
				<GoLive
					eventId={event.id}
					address={session.address}
					initialQuote={{
						fee: quote.fee,
						balance: quote.balance,
						shortfall: quote.shortfall,
					}}
					judgingDeadline={judgingDeadline}
					symbol={env.USDC_SYMBOL}
				/>
			)}
		</Shell>
	);
}
