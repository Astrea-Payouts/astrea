import {
	ExternalLink,
	ShieldCheck,
	Trophy,
	Wallet as WalletIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TxHashLink } from "@/components/tx-hash-link";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getExplorerAccountUrl } from "@/lib/explorer";
import { STELLAR_NETWORK } from "@/lib/stellar-network";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; login: string }>;

function GithubIcon({ className = "size-5" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			className={className}
			aria-hidden="true"
		>
			<path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.26 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A10.98 10.98 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
		</svg>
	);
}

function shortAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { login } = await params;
	return {
		title: `${login} — Public Profile | Astrea`,
		description: `Verified builder profile for ${login} on Astrea.`,
	};
}

export default async function PublicProfilePage({
	params,
}: {
	params: Params;
}) {
	const { login } = await params;

	const linkedAccount = await db.linkedAccount.findFirst({
		where: {
			provider: "GITHUB",
			username: { equals: login, mode: "insensitive" },
		},
		include: {
			wallet: {
				include: {
					teamMemberships: {
						include: {
							team: {
								include: {
									event: {
										select: {
											id: true,
											name: true,
											network: true,
											status: true,
										},
									},
									wonPrizes: {
										include: {
											payouts: true,
										},
									},
								},
							},
							payouts: true,
						},
					},
				},
			},
		},
	});

	if (!linkedAccount?.wallet.profilePublic) {
		notFound();
	}

	const wallet = linkedAccount.wallet;
	const t = await getTranslations("Profile");

	const memberships = wallet.teamMemberships;

	return (
		<main className="min-h-screen bg-black px-4 py-12 text-white">
			<div className="mx-auto max-w-4xl space-y-8">
				{/* Profile Header */}
				<header className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950 p-6 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-4">
						{linkedAccount.avatarUrl ? (
							// biome-ignore lint/performance/noImgElement: dynamic external avatar URL
							<img
								src={linkedAccount.avatarUrl}
								alt={`${linkedAccount.username}'s avatar`}
								className="size-16 rounded-full border border-white/10"
							/>
						) : (
							<div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-zinc-900">
								<GithubIcon className="size-8 text-zinc-400" />
							</div>
						)}
						<div>
							<h1 className="text-2xl font-bold tracking-tight text-white">
								{linkedAccount.username}
							</h1>
							<a
								href={
									linkedAccount.profileUrl ??
									`https://github.com/${linkedAccount.username}`
								}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-0.5 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
							>
								<GithubIcon className="size-3.5" />
								<span>github.com/{linkedAccount.username}</span>
								<ExternalLink className="size-3" />
							</a>
						</div>
					</div>

					<div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4">
						<div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
							<WalletIcon className="size-3.5" />
							<span>{t("stellarWallet")}</span>
						</div>
						<a
							href={getExplorerAccountUrl(wallet.address, STELLAR_NETWORK)}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-1 inline-block font-mono text-sm text-zinc-200 underline-offset-4 hover:underline"
							title={wallet.address}
						>
							{shortAddress(wallet.address)}
						</a>
					</div>
				</header>

				{/* Participation & Payout History */}
				<section className="space-y-4">
					<h2 className="text-lg font-semibold text-zinc-200">
						{t("participations")}
					</h2>

					{memberships.length === 0 ? (
						<div className="rounded-xl border border-white/5 bg-zinc-950 p-8 text-center text-sm text-zinc-400">
							{t("noParticipations")}
						</div>
					) : (
						<div className="grid gap-4">
							{memberships.map((membership) => {
								const team = membership.team;
								const event = team.event;
								const prizes = team.wonPrizes;
								const payouts = membership.payouts;

								return (
									<div
										key={membership.id}
										className="flex flex-col gap-4 rounded-xl border border-white/10 bg-zinc-950 p-5 sm:flex-row sm:items-start sm:justify-between"
									>
										<div className="space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<Link
													href={`/events/${event.id}`}
													className="text-base font-semibold text-white hover:underline"
												>
													{event.name}
												</Link>
												{team.submissionVerifiedAt && (
													<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
														<ShieldCheck className="size-3" />
														{t("verifiedSubmission")}
													</span>
												)}
											</div>

											<div className="text-sm text-zinc-400">
												<span className="text-zinc-500">{t("team")}:</span>{" "}
												<span className="text-zinc-300">{team.name}</span>
											</div>

											{team.submissionUrl && (
												<div className="pt-1">
													<a
														href={team.submissionUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 underline-offset-4 hover:underline font-mono"
													>
														<span>{team.submissionUrl}</span>
														<ExternalLink className="size-3" />
													</a>
												</div>
											)}
										</div>

										{prizes.length > 0 && (
											<div className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-right sm:min-w-[200px]">
												<div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 sm:justify-end">
													<Trophy className="size-3.5" />
													<span>{t("prizesWon")}</span>
												</div>
												{prizes.map((prize) => (
													<div key={prize.id} className="text-sm">
														<span className="font-semibold text-white">
															{prize.amount.toString()} USDC
														</span>
														<span className="text-xs text-zinc-400">
															{" "}
															(Rank #{prize.rank})
														</span>
													</div>
												))}

												{payouts.length > 0 && (
													<div className="pt-2 border-t border-white/5 flex flex-col gap-1 items-end">
														<span className="text-xs text-zinc-400">
															{t("payoutConfirmed")}:
														</span>
														{payouts.map((payout) => (
															<TxHashLink
																key={payout.id}
																hash={payout.txHash}
																network={
																	event.network.toLowerCase() as
																		| "testnet"
																		| "mainnet"
																}
															/>
														))}
													</div>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
