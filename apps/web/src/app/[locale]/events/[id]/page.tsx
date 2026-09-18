import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EventStatusBadge } from "@/components/events/status-badge";
import { TxHashLink } from "@/components/tx-hash-link";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import {
	formatSmallestUnits,
	getExplorerAccountUrl,
	getExplorerContractUrl,
} from "@/lib/explorer";
import { STELLAR_NETWORK } from "@/lib/stellar-network";
import { getSessionWallet } from "@/lib/wallet/session";
import { JudgingToggle } from "./judging-toggle";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

async function loadEvent(id: string) {
	return db.event.findUnique({
		where: { id },
		include: {
			organizerWallet: { select: { id: true, address: true } },
			prizes: { orderBy: { rank: "asc" } },
			judges: { where: { status: "ACTIVE" } },
			teams: {
				orderBy: { createdAt: "asc" },
				include: {
					members: {
						orderBy: { ordinal: "asc" },
						include: { wallet: { select: { id: true, address: true } } },
					},
				},
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
	const event = await db.event.findUnique({
		where: { id },
		select: { name: true, description: true },
	});
	if (!event) return {};
	const description =
		event.description ?? "Escrow-backed prize payouts on Stellar Soroban";
	return {
		title: event.name,
		description,
		openGraph: {
			title: event.name,
			description,
		},
		twitter: {
			card: "summary_large_image",
			title: event.name,
			description,
		},
	};
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
			className="font-mono text-sm text-zinc-200 underline-offset-4 hover:underline break-all"
			title={address}
		>
			{shortAddress(address)}
		</a>
	);
}

export default async function EventPage({ params }: { params: Params }) {
	const { id, locale } = await params;
	const event = await loadEvent(id);
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

	return (
		<main className="min-h-screen bg-black text-white pt-28 pb-16 px-4 sm:px-6 md:py-12 md:px-12">
			<div className="mx-auto max-w-3xl flex flex-col gap-8">
				<header className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<EventStatusBadge status={event.status} className="w-fit" />
						<div className="flex items-center gap-4 text-xs font-medium">
							{event.status === "LIVE" || event.status === "JUDGING" ? (
								<a
									href={`/${locale}/events/${id}/display.png`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline"
								>
									{t("display.showOnScreen")}
								</a>
							) : null}
							{event.status === "COMPLETED" ? (
								<Link
									href={`/events/${event.id}/print`}
									className="text-zinc-400 hover:text-zinc-200 underline-offset-4 hover:underline"
								>
									{t("print.receipt")}
								</Link>
							) : null}
						</div>
					</div>
					<h1 className="font-serif text-3xl font-bold tracking-tight md:text-5xl break-words">
						{event.name}
					</h1>
					{event.description ? (
						<p className="text-sm leading-relaxed text-zinc-400 md:text-base whitespace-pre-line">
							{event.description}
						</p>
					) : null}
				</header>

				<section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 flex flex-col gap-3">
					<h2 className="text-lg font-bold">{t("escrow.title")}</h2>
					{event.escrowEventId ? (
						<>
							{escrow ? (
								<p className="text-2xl font-semibold text-emerald-300">
									{formatSmallestUnits(escrow.reward)} {env.USDC_SYMBOL}
									<span className="ml-2 text-xs font-normal text-zinc-400">
										{t("escrow.onChainState", { state: escrow.state })}
									</span>
								</p>
							) : (
								<p className="text-sm text-red-300 break-words" role="alert">
									{t("escrow.readFailed")}{" "}
									<code className="font-mono text-xs">{escrowError}</code>
								</p>
							)}
							<dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
								<dt className="text-zinc-400">{t("escrow.eventId")}</dt>
								<dd className="font-mono text-xs break-all">
									{event.escrowEventId}
								</dd>
								<dt className="text-zinc-400">{t("escrow.contract")}</dt>
								<dd>
									<a
										href={getExplorerContractUrl(
											env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
											STELLAR_NETWORK,
										)}
										target="_blank"
										rel="noopener noreferrer"
										className="font-mono text-xs underline-offset-4 hover:underline break-all"
									>
										{env.NEXT_PUBLIC_ESCROW_CONTRACT_ID}
									</a>
								</dd>
							</dl>
						</>
					) : (
						<p className="text-sm text-zinc-400">{t("escrow.notOnChain")}</p>
					)}
				</section>

				<section className="flex flex-col gap-3">
					<h2 className="text-lg font-bold">{t("prizes.title")}</h2>
					{event.prizes.length === 0 ? (
						<p className="text-sm text-zinc-400">{t("prizes.none")}</p>
					) : (
						<ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
							{event.prizes.map((prize) => {
								const winner = prize.winnerTeamId
									? event.teams.find((team) => team.id === prize.winnerTeamId)
									: null;
								return (
									<li
										key={prize.id}
										className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
									>
										<span className="font-medium">
											{t("prizes.rank", { rank: prize.rank })}
										</span>
										<span className="font-mono">
											{prize.amount.toString()} {env.USDC_SYMBOL}
										</span>
										{winner ? (
											<span className="w-full text-xs text-zinc-400">
												{t("prizes.winner", { team: winner.name })}
											</span>
										) : null}
										{prize.releaseTxHash ? (
											<div className="w-full flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
												<span>{t("prizes.paidTx")}:</span>
												<TxHashLink
													hash={prize.releaseTxHash}
													network={STELLAR_NETWORK}
													leadingChars={8}
													trailingChars={8}
												/>
											</div>
										) : null}
									</li>
								);
							})}
						</ul>
					)}
				</section>

				<section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="rounded-2xl border border-white/10 p-4 flex flex-col gap-1">
						<h2 className="text-sm font-semibold text-zinc-400">
							{t("people.organizer")}
						</h2>
						<AddressLink address={event.organizerWallet.address} />
					</div>
					<div className="rounded-2xl border border-white/10 p-4 flex flex-col gap-1">
						<h2 className="text-sm font-semibold text-zinc-400">
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
				</section>

				<section className="flex flex-col gap-3">
					<h2 className="text-lg font-bold">
						{t("teams.title", { count: event.teams.length })}
					</h2>
					{event.teams.length === 0 ? (
						<p className="text-sm text-zinc-400">{t("teams.none")}</p>
					) : (
						<ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
							{event.teams.map((team) => (
								<li
									key={team.id}
									className="flex flex-col gap-1 px-4 py-3 text-sm"
								>
									<span className="font-medium break-words">{team.name}</span>
									{team.members.map((member) => (
										<AddressLink
											key={member.id}
											address={member.wallet.address}
										/>
									))}
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="rounded-2xl border border-emerald-500/20 bg-zinc-900/40 p-5 flex flex-col gap-3">
					{!session ? (
						<>
							<p className="text-sm text-zinc-300">{t("cta.connect")}</p>
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
									className="inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 sm:w-auto"
								>
									{t("organizer.goLive")}
								</Link>
							) : null}

							{isJudge ? (
								<Link
									href={`/events/${event.id}/judge`}
									className="inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 sm:w-auto"
								>
									{t("cta.judge")}
								</Link>
							) : null}

							{event.status === "LIVE" && !isRegistered && !isOrganizer ? (
								<>
									<p className="text-sm text-zinc-300">{t("cta.register")}</p>
									<RegistrationForm eventId={event.id} />
								</>
							) : null}

							{isRegistered ? (
								<p className="text-sm text-emerald-300">
									{t("cta.registered")}
								</p>
							) : null}

							{!isOrganizer &&
							!isJudge &&
							!isRegistered &&
							event.status !== "LIVE" ? (
								<p className="text-sm text-zinc-400">
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
