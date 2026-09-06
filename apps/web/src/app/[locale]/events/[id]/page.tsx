import { Scale, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnchainBadge } from "@/components/event/onchain-badge";
import { PayoutHistory } from "@/components/event/payout-history";
import { PrizeList } from "@/components/event/prize-list";
import {
	getPublicEventById,
	type PublicEventView,
} from "@/lib/event-public-view";
import { truncateHash } from "@/lib/explorer";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://astrea.app";

export const dynamic = "force-dynamic";

interface EventPageProps {
	params: Promise<{
		locale: string;
		id: string;
	}>;
}

export async function generateMetadata({
	params,
}: EventPageProps): Promise<Metadata> {
	const { locale, id } = await params;
	const event = await getPublicEventById(id);

	if (!event) {
		return {
			title: "Event Not Found",
			description:
				"The requested prize escrow event does not exist or has been removed.",
		};
	}

	const title = `${event.name} - Verified Prize Escrow`;
	const prizeTotal = `$${event.totalPrizeUsdc.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USDC`;
	const description =
		event.description ||
		`Compete in ${event.name} with ${prizeTotal} in smart escrow on Stellar. Prizes verified on-chain before competition starts.`;
	const canonicalUrl = `${siteUrl}/${locale}/events/${id}`;

	return {
		title,
		description,
		alternates: {
			canonical: canonicalUrl,
		},
		openGraph: {
			title: `${title} | Astrea`,
			description,
			url: canonicalUrl,
			siteName: "Astrea",
			type: "website",
			locale,
		},
		twitter: {
			card: "summary_large_image",
			title: `${title} | Astrea`,
			description,
		},
	};
}

export function buildEventJsonLd(event: PublicEventView, locale: string) {
	const eventUrl = `${siteUrl}/${locale}/events/${event.id}`;
	const startDate = event.startsAt ? event.startsAt.toISOString() : undefined;
	const endDate = event.endsAt ? event.endsAt.toISOString() : undefined;

	return {
		"@context": "https://schema.org",
		"@type": "Event",
		name: event.name,
		description:
			event.description ??
			`Hackathon with ${event.totalPrizeUsdc} USDC in escrow`,
		...(startDate ? { startDate } : {}),
		...(endDate ? { endDate } : {}),
		eventStatus:
			event.status === "CANCELLED"
				? "https://schema.org/EventCancelled"
				: event.status === "COMPLETED"
					? "https://schema.org/EventMovedOnline"
					: "https://schema.org/EventScheduled",
		eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
		location: {
			"@type": "VirtualLocation",
			url: eventUrl,
		},
		organizer: {
			"@type": "Organization",
			name: "Astrea",
			url: siteUrl,
		},
		offers: event.prizes.map((p) => ({
			"@type": "Offer",
			name: `Rank #${p.rank} Prize`,
			price: p.amountUsdc,
			priceCurrency: "USD",
			availability: "https://schema.org/InStock",
			url: eventUrl,
		})),
	};
}

function formatDate(date: Date | null): string {
	if (!date) return "TBD";
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export default async function EventPage({ params }: EventPageProps) {
	const { locale, id } = await params;
	const event = await getPublicEventById(id);

	if (!event) {
		notFound();
	}

	const jsonLd = buildEventJsonLd(event, locale);

	return (
		<main className="relative isolate min-h-screen bg-black px-6 py-16 text-white md:px-12 lg:px-20">
			{/* JSON-LD Structured Data */}
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Valid JSON-LD structured data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>

			{/* Background subtle glow */}
			<div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_70%)]" />

			<div className="mx-auto max-w-5xl">
				{/* Top Header / Breadcrumb */}
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<OnchainBadge
						contractId={event.escrowContractId}
						network={event.network}
						showContractLink={true}
					/>
					<span className="text-xs font-mono text-white/40 uppercase tracking-widest">
						Stellar {event.network}
					</span>
				</div>

				{/* Event Title and Details */}
				<div className="mb-12">
					<p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emerald-400 uppercase">
						Smart Escrow Competition
					</p>
					<h1 className="font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
						{event.name}
					</h1>

					{event.description && (
						<p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
							{event.description}
						</p>
					)}

					{/* Key Metrics Strip */}
					<div className="mt-8 grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-zinc-950/60 p-5 backdrop-blur-sm sm:grid-cols-4">
						<div>
							<span className="text-xs text-white/40 uppercase tracking-wider">
								Total Prize Pool
							</span>
							<p className="mt-1 font-mono text-xl font-bold text-emerald-400 sm:text-2xl">
								${event.totalPrizeUsdc.toLocaleString("en-US")}{" "}
								<span className="text-sm">USDC</span>
							</p>
						</div>
						<div>
							<span className="text-xs text-white/40 uppercase tracking-wider">
								Status
							</span>
							<p className="mt-1 font-semibold text-white sm:text-lg uppercase">
								{event.status}
							</p>
						</div>
						<div>
							<span className="text-xs text-white/40 uppercase tracking-wider">
								Starts
							</span>
							<p className="mt-1 text-sm font-medium text-white/80 sm:text-base">
								{formatDate(event.startsAt)}
							</p>
						</div>
						<div>
							<span className="text-xs text-white/40 uppercase tracking-wider">
								Ends
							</span>
							<p className="mt-1 text-sm font-medium text-white/80 sm:text-base">
								{formatDate(event.endsAt)}
							</p>
						</div>
					</div>
				</div>

				{/* Section 1: Prizes */}
				<section className="mb-14">
					<div className="mb-6 flex items-center justify-between">
						<div>
							<h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
								Prize Milestones
							</h2>
							<p className="mt-1 text-xs text-white/50">
								Funds locked on-chain and released per milestone independently.
							</p>
						</div>
					</div>

					<PrizeList prizes={event.prizes} />
				</section>

				{/* Section 2: Judges & Resolver */}
				<section className="mb-14">
					<div className="mb-6">
						<h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
							Judges & Governance
						</h2>
						<p className="mt-1 text-xs text-white/50">
							Published upfront before the event begins so participants know who
							backstops evaluation.
						</p>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{/* Judges Card */}
						<div className="rounded-xl border border-white/10 bg-zinc-950/80 p-5 backdrop-blur-sm">
							<div className="flex items-center gap-2 text-sm font-semibold text-white/80">
								<Users
									className="h-4 w-4 text-emerald-400"
									aria-hidden="true"
								/>
								<span>Official Judges ({event.judges.length})</span>
							</div>

							{event.judges.length > 0 ? (
								<ul className="mt-3 divide-y divide-white/5">
									{event.judges.map((judge) => (
										<li
											key={judge.id}
											className="flex items-center justify-between py-2 text-xs font-mono text-white/70"
										>
											<span>{truncateHash(judge.walletAddress, 8, 8)}</span>
											<span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40 uppercase">
												{judge.status}
											</span>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-3 text-xs text-white/40">
									Organizer judging panel assigned on-chain.
								</p>
							)}
						</div>

						{/* Dispute Resolver Card */}
						<div className="rounded-xl border border-white/10 bg-zinc-950/80 p-5 backdrop-blur-sm">
							<div className="flex items-center gap-2 text-sm font-semibold text-white/80">
								<Scale className="h-4 w-4 text-amber-400" aria-hidden="true" />
								<span>Dispute Resolver</span>
							</div>

							<div className="mt-3 text-xs text-white/70">
								<p className="font-medium text-white">{event.resolver.name}</p>
								<p className="mt-1 text-[11px] leading-relaxed text-white/40">
									Third-party dispute backstop capable of resolving milestone
									deadlocks if consensus is disputed.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Section 3: Payout History */}
				<section className="mb-14">
					<div className="mb-6">
						<h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
							Payout History & On-Chain Proofs
						</h2>
						<p className="mt-1 text-xs text-white/50">
							Direct cryptographic verification on the Stellar ledger for every
							released prize.
						</p>
					</div>

					<PayoutHistory items={event.prizes} network={event.network} />
				</section>
			</div>
		</main>
	);
}
