import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import { buildEventCardModel } from "@/lib/events/card-model";
import { getExplorerContractUrl, getExplorerTxUrl } from "@/lib/explorer";
import { qrSvgPath } from "@/lib/qr";
import { STELLAR_NETWORK } from "@/lib/stellar-network";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

/**
 * Generates localized page metadata for the printable event payout receipt.
 */
export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { id } = await params;
	const event = await db.event.findUnique({
		where: { id },
		select: { name: true },
	});
	if (!event) return {};
	return {
		title: `${event.name} — Print Receipt | Astrea`,
		description: `Official on-chain payout receipt for ${event.name}`,
	};
}

/**
 * Renders the printable A4 payout receipt for a completed event, or 404 otherwise.
 */
export default async function EventPrintPage({ params }: { params: Params }) {
	const { id, locale } = await params;

	const event = await db.event.findUnique({
		where: { id },
		include: {
			organizerWallet: { select: { address: true } },
			prizes: { orderBy: { rank: "asc" } },
			judges: { where: { status: "ACTIVE" } },
			teams: {
				orderBy: { createdAt: "asc" },
				include: {
					members: {
						orderBy: { ordinal: "asc" },
						include: {
							wallet: {
								select: {
									address: true,
									linkedAccounts: {
										where: { provider: "github" },
										select: { provider: true, username: true },
									},
								},
							},
						},
					},
				},
			},
		},
	});

	// Decision 6 & Acceptance criteria: print layout is COMPLETED state only (404 otherwise)
	if (event?.status !== "COMPLETED") {
		notFound();
		return null;
	}

	let escrow: Awaited<ReturnType<typeof readEscrowEvent>> | null = null;
	if (event.escrowEventId) {
		try {
			escrow = await readEscrowEvent(event.escrowEventId);
		} catch {
			escrow = null;
		}
	}

	const model = buildEventCardModel({
		event,
		escrow,
		locale,
		assetSymbol: env.USDC_SYMBOL ?? "USDC",
	});

	const appBase = process.env.NEXT_PUBLIC_APP_URL || "https://astrea.app";
	const canonicalUrl = `${appBase}/${locale}/events/${id}`;
	const qr = qrSvgPath(canonicalUrl);

	return (
		<main className="min-h-screen bg-white text-black p-6 sm:p-10 font-sans print:p-0 print:m-0">
			<style>{`
				@media print {
					@page {
						size: A4 portrait;
						margin: 12mm;
					}
					body {
						background: white !important;
						color: black !important;
					}
					.no-print {
						display: none !important;
					}
				}
			`}</style>

			{/* Screen Controls */}
			<div className="no-print mx-auto max-w-3xl mb-8 flex items-center justify-between border-b border-zinc-200 pb-4">
				<Link
					href={`/events/${id}`}
					className="text-sm font-medium text-zinc-600 hover:text-black"
				>
					← Back to event
				</Link>
				<PrintButton />
			</div>

			{/* A4 Container */}
			<article className="mx-auto max-w-3xl border border-zinc-300 p-8 sm:p-12 print:border-none print:p-0">
				{/* Header */}
				<header className="flex justify-between items-start border-b-2 border-black pb-6">
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<span className="text-xl font-extrabold tracking-widest uppercase">
								ASTREA
							</span>
							<span className="text-xs bg-zinc-100 text-zinc-800 border border-zinc-300 font-mono px-2 py-0.5 rounded">
								STELLAR SMART ESCROW
							</span>
						</div>
						<h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
							{model.name}
						</h1>
						<p className="text-xs text-zinc-500 font-mono">
							OFFICIAL ON-CHAIN PRIZE PAYOUT RECEIPT
						</p>
					</div>

					{/* QR Code */}
					<div className="flex flex-col items-center gap-1">
						<div className="border border-zinc-300 p-1 rounded bg-white">
							<svg
								viewBox={`0 0 ${qr.size} ${qr.size}`}
								width="96"
								height="96"
								shapeRendering="crispEdges"
								aria-label="Event QR Code"
							>
								<title>Event QR Code</title>
								<path d={qr.path} fill="#000000" />
							</svg>
						</div>
						<span className="text-[10px] text-zinc-500 font-mono">
							Scan for live audit
						</span>
					</div>
				</header>

				{/* Summary Overview */}
				<section className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-zinc-200 text-sm">
					<div>
						<div className="text-xs text-zinc-500 uppercase font-semibold">
							Total Distributed
						</div>
						<div className="text-lg font-bold font-mono text-emerald-700">
							{model.prizePool.amount} {model.prizePool.asset}
						</div>
					</div>
					<div>
						<div className="text-xs text-zinc-500 uppercase font-semibold">
							Event Status
						</div>
						<div className="text-sm font-semibold text-black uppercase">
							COMPLETED / PAID
						</div>
					</div>
					<div>
						<div className="text-xs text-zinc-500 uppercase font-semibold">
							Organizer
						</div>
						<div
							className="font-mono text-xs truncate"
							title={event.organizerWallet.address}
						>
							{model.organizer}
						</div>
					</div>
					<div>
						<div className="text-xs text-zinc-500 uppercase font-semibold">
							Judge(s)
						</div>
						<div className="text-xs truncate">
							{model.judges.join(", ") || "None"}
						</div>
					</div>
				</section>

				{/* Escrow Details */}
				<section className="py-4 border-b border-zinc-200 text-xs flex flex-col gap-1 font-mono text-zinc-600">
					<div>
						<span className="font-semibold text-zinc-800">
							Escrow Event ID:{" "}
						</span>
						<span>{event.escrowEventId ?? "N/A"}</span>
					</div>
					<div>
						<span className="font-semibold text-zinc-800">Contract: </span>
						<a
							href={getExplorerContractUrl(
								env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
								STELLAR_NETWORK,
							)}
							target="_blank"
							rel="noopener noreferrer"
							className="underline break-all"
						>
							{env.NEXT_PUBLIC_ESCROW_CONTRACT_ID}
						</a>
					</div>
				</section>

				{/* Winners Breakdown Table */}
				<section className="py-6">
					<h2 className="text-sm font-bold uppercase tracking-wider mb-4">
						Verified Winners & On-Chain Payout Receipts
					</h2>

					{model.winners.length === 0 ? (
						<p className="text-sm text-zinc-500">No winners recorded.</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse text-xs">
								<thead>
									<tr className="border-b-2 border-black text-zinc-800">
										<th className="py-2 pr-3 font-bold">Rank</th>
										<th className="py-2 pr-3 font-bold">Team</th>
										<th className="py-2 pr-3 font-bold">Members</th>
										<th className="py-2 pr-3 font-bold text-right">Amount</th>
										<th className="py-2 font-bold">On-Chain Tx Hash</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-200">
									{model.winners.map((winner) => (
										<tr key={winner.rank} className="align-top">
											<td className="py-3 pr-3 font-bold font-mono">
												#{winner.rank}
											</td>
											<td className="py-3 pr-3 font-semibold">
												{winner.teamName}
											</td>
											<td className="py-3 pr-3 text-zinc-600">
												{winner.members.join(", ") || "—"}
											</td>
											<td className="py-3 pr-3 font-mono font-bold text-right whitespace-nowrap">
												{winner.amount} {winner.asset}
											</td>
											<td className="py-3 font-mono text-[11px] break-all">
												{winner.txHash ? (
													<a
														href={getExplorerTxUrl(
															winner.txHash,
															STELLAR_NETWORK,
														)}
														target="_blank"
														rel="noopener noreferrer"
														className="text-zinc-800 underline hover:text-black"
													>
														{winner.txHash}
													</a>
												) : (
													<span className="text-zinc-400">Pending</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>

				{/* Footer */}
				<footer className="border-t-2 border-black pt-6 mt-8 flex justify-between items-center text-xs text-zinc-500">
					<span>Astrea • Non-custodial escrow payouts on Stellar Soroban</span>
					<span className="font-mono">
						{new Date().toISOString().slice(0, 10)}
					</span>
				</footer>
			</article>
		</main>
	);
}
