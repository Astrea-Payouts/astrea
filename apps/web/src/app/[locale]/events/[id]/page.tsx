import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OnchainBadge } from "@/components/event/onchain-badge";
import { PayoutHistory } from "@/components/event/payout-history";
import { PrizeList } from "@/components/event/prize-list";
import { EventStatusBadge } from "@/components/events/status-badge";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import {
	loadPublicEventView,
	resolveDisputeResolver,
} from "@/lib/events/public-view";
import { getExplorerAccountUrl } from "@/lib/explorer";
import { STELLAR_NETWORK } from "@/lib/stellar-network";
import { getSessionWallet } from "@/lib/wallet/session";
import { JudgingToggle } from "./judging-toggle";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

/**
 * Generates SEO metadata for the public event page using only public fields.
 */
export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { id } = await params;
	const event = await db.event.findUnique({
		where: { id },
		select: { name: true, description: true },
	});
	if (!event) return {};
	return { title: event.name, description: event.description ?? undefined };
}

function shortAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function AddressLink({ address }: { address: string }) {
	return (
		<a
			href={getExplorerAccountUrl(address, STELLAR_NETWORK)}
			target="_blank"
			rel="noopener noreferrer"
			className="font-mono text-sm break-all text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-200"
			title={address}
		>
			{shortAddress(address)}
		</a>
	);
}

/**
 * Renders the SSR public event page (U03 / Issue #64):
 * - On-chain badge & contract link gated on real `create_event` confirmation
 * - Prize/milestone list wrapped in React Bits' Border Glow (static border on touch)
 * - Judges + dispute resolver section (stating "Astrea (default)" per ADR-003)
 * - Payout history with explorer transaction links for released prizes
 */
export default async function EventPage({ params }: { params: Params }) {
	const { id } = await params;
	const event = await loadPublicEventView(id);
	if (!event) notFound();

	const t = await getTranslations("EventPage");
	const session = await getSessionWallet();

	const judge = event.judges.length === 1 ? event.judges[0] : null;
	const isOrganizer = session?.id === event.organizerWalletId;
	const isJudge = !!session && judge?.walletAddress === session.address;
	const isRegistered =
		!!session &&
		event.teams.some((team) =>
			team.members.some((m) => m.walletId === session.id),
		);

	// The reserved amount comes from the chain, never from the Prize rows —
	// that is the whole point of the page (issue #15). A read failure is
	// shown as such, not hidden behind the Postgres sum.
	let escrow: Awaited<ReturnType<typeof readEscrowEvent>> | null = null;
	let escrowError: string | null = null;
	if (event.escrowEventId) {
		try {
			escrow = await readEscrowEvent(event.escrowEventId);
		} catch (err) {
			escrowError = err instanceof Error ? err.message : String(err);
		}
	}

	const resolver = resolveDisputeResolver(
		escrow?.resolver,
		t("people.defaultResolver"),
	);

	return (
		<main className="min-h-screen bg-white px-4 pt-28 pb-16 text-zinc-950 sm:px-6 md:px-12 md:py-12 dark:bg-black dark:text-white">
			<div className="mx-auto flex max-w-3xl flex-col gap-8">
				<header className="flex flex-col gap-3">
					<EventStatusBadge status={event.status} className="w-fit" />
					<h1 className="font-serif text-3xl font-bold tracking-tight break-words md:text-5xl">
						{event.name}
					</h1>
					{event.description ? (
						<p className="text-sm leading-relaxed whitespace-pre-line text-zinc-600 md:text-base dark:text-zinc-400">
							{event.description}
						</p>
					) : null}
				</header>

				<OnchainBadge
					escrowEventId={event.escrowEventId}
					escrow={escrow}
					escrowError={escrowError}
					contractId={env.NEXT_PUBLIC_ESCROW_CONTRACT_ID}
					assetSymbol={env.USDC_SYMBOL}
					network={STELLAR_NETWORK}
					labels={{
						title: t("escrow.title"),
						verifiedBadge: t("escrow.verifiedBadge"),
						onChainState: escrow
							? t("escrow.onChainState", { state: escrow.state })
							: "",
						readFailed: t("escrow.readFailed"),
						eventId: t("escrow.eventId"),
						contract: t("escrow.contract"),
						notOnChain: t("escrow.notOnChain"),
					}}
				/>

				<PrizeList
					prizes={event.prizes}
					teams={event.teams}
					assetSymbol={env.USDC_SYMBOL}
					network={STELLAR_NETWORK}
					labels={{
						title: t("prizes.title"),
						none: t("prizes.none"),
						formatRank: (rank) => t("prizes.rank", { rank }),
						formatWinner: (team) => t("prizes.winner", { team }),
						paidTx: t("prizes.paidTx"),
					}}
				/>

				<PayoutHistory
					prizes={event.prizes}
					teams={event.teams}
					assetSymbol={env.USDC_SYMBOL}
					network={STELLAR_NETWORK}
					labels={{
						title: t("payoutHistory.title"),
						empty: t("payoutHistory.empty"),
						formatRank: (rank) => t("prizes.rank", { rank }),
						unassignedWinner: t("payoutHistory.unassignedWinner"),
						txProof: t("payoutHistory.txProof"),
					}}
				/>

				<section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-4 dark:border-white/10">
						<h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
							{t("people.organizer")}
						</h2>
						<AddressLink address={event.organizerWallet.address} />
					</div>
					<div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-4 dark:border-white/10">
						<h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
							{t("people.judge")}
						</h2>
						{judge ? (
							<>
								<span className="text-sm">{judge.displayName}</span>
								<AddressLink address={judge.walletAddress} />
							</>
						) : (
							<span className="text-sm text-zinc-500">
								{t("people.noJudge", { count: event.judges.length })}
							</span>
						)}
					</div>
					<div
						data-testid="resolver-card"
						className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-4 dark:border-white/10"
					>
						<h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
							{t("people.resolver")}
						</h2>
						{resolver.isDefault || !resolver.address ? (
							<span className="text-sm font-medium">{resolver.label}</span>
						) : (
							<AddressLink address={resolver.address} />
						)}
					</div>
				</section>

				<section className="flex flex-col gap-3">
					<h2 className="text-lg font-bold">
						{t("teams.title", { count: event.teams.length })}
					</h2>
					{event.teams.length === 0 ? (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							{t("teams.none")}
						</p>
					) : (
						<ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-white/10 dark:border-white/10">
							{event.teams.map((team) => (
								<li
									key={team.id}
									className="flex flex-col gap-1 px-4 py-3 text-sm"
								>
									<span className="font-medium break-words">{team.name}</span>
									{team.members.map((member) => (
										<AddressLink
											key={member.walletId}
											address={member.wallet.address}
										/>
									))}
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-zinc-50/80 p-5 dark:bg-zinc-900/40">
					{!session ? (
						<>
							<p className="text-sm text-zinc-700 dark:text-zinc-300">
								{t("cta.connect")}
							</p>
							<WalletConnectButton className="w-full sm:w-auto" />
						</>
					) : (
						<>
							{isOrganizer && event.status === "LIVE" ? (
								<JudgingToggle eventId={event.id} />
							) : null}

							{isOrganizer && event.status === "CREATED" ? (
								// The reserve is on-chain (see the escrow section above);
								// /start pays the go-live fee and signs set_event_in_progress.
								<Link
									href={`/organizer/events/${event.id}/start`}
									className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto dark:bg-white dark:text-black dark:hover:bg-white/90"
								>
									{t("organizer.goLive")}
								</Link>
							) : null}

							{isJudge ? (
								<Link
									href={`/events/${event.id}/judge`}
									className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto dark:bg-white dark:text-black dark:hover:bg-white/90"
								>
									{t("cta.judge")}
								</Link>
							) : null}

							{event.status === "LIVE" && !isRegistered && !isOrganizer ? (
								<>
									<p className="text-sm text-zinc-700 dark:text-zinc-300">
										{t("cta.register")}
									</p>
									<RegistrationForm eventId={event.id} />
								</>
							) : null}

							{isRegistered ? (
								<p className="text-sm text-emerald-700 dark:text-emerald-300">
									{t("cta.registered")}
								</p>
							) : null}

							{!isOrganizer &&
							!isJudge &&
							!isRegistered &&
							event.status !== "LIVE" ? (
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									{t("cta.registrationClosed")}
								</p>
							) : null}
						</>
					)}
				</section>
			</div>
		</main>
	);
}
