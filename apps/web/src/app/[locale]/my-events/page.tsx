"use client";

import { Award, ChevronRight, ShieldCheck, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EventCountdown } from "@/components/event-countdown";
import { WalletConnectButton } from "@/components/wallet-connect-button";

interface EventItem {
	id: string;
	title: string;
	description: string;
	role: "participant" | "judge" | "organizer";
	prizePool: string;
	deadline: string;
	status: "active" | "judging" | "completed";
}

const DEMO_MY_EVENTS: EventItem[] = [
	{
		id: "stellar-hackathon-2026",
		title: "Stellar Global Builders Hackathon 2026",
		description:
			"Decentralized applications, Soroban smart contracts, and micro-payment rails.",
		role: "participant",
		prizePool: "50,000 USDC",
		deadline: new Date(
			Date.now() + 4 * 86400 * 1000 + 6 * 3600 * 1000,
		).toISOString(),
		status: "active",
	},
	{
		id: "soroban-defi-sprint",
		title: "Soroban DeFi Innovation Sprint",
		description:
			"Automated market makers, yield strategies, and escrow tooling.",
		role: "judge",
		prizePool: "25,000 XLM",
		deadline: new Date(
			Date.now() + 1 * 86400 * 1000 + 12 * 3600 * 1000,
		).toISOString(),
		status: "judging",
	},
];

export default function MyEventsPage() {
	const [activeFilter, setActiveFilter] = useState<
		"all" | "participant" | "judge" | "organizer"
	>("all");
	const [events] = useState<EventItem[]>(DEMO_MY_EVENTS);

	const filteredEvents = events.filter((ev) => {
		if (activeFilter === "all") return true;
		return ev.role === activeFilter;
	});

	return (
		<main className="min-h-screen bg-black text-white px-6 py-16 md:px-12">
			<div className="max-w-5xl mx-auto space-y-8">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-zinc-800/80">
					<div>
						<div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-indigo-400 uppercase mb-2">
							<ShieldCheck className="w-4 h-4" />
							<span>Verified Identity</span>
						</div>
						<h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">
							My Events & Deadlines
						</h1>
						<p className="text-sm text-zinc-400 mt-1 max-w-xl">
							Cross-device dashboard of hackathons, bounties, and judging tracks
							linked to your verified wallet.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<WalletConnectButton className="bg-white text-black hover:bg-zinc-200" />
					</div>
				</div>

				{/* Filter Tabs */}
				<div className="flex flex-wrap items-center gap-2">
					{(["all", "participant", "judge", "organizer"] as const).map(
						(tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => setActiveFilter(tab)}
								className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
									activeFilter === tab
										? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
										: "bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-900"
								}`}
							>
								{tab === "all" ? "All Events" : tab}
							</button>
						),
					)}
				</div>

				{/* Events List */}
				{filteredEvents.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 text-center">
						<Trophy className="w-10 h-10 text-zinc-600 mb-3" />
						<h3 className="text-base font-semibold text-zinc-300">
							No events found
						</h3>
						<p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4">
							You haven't joined or been assigned to any events under this role
							yet.
						</p>
						<Link
							href="/"
							className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
						>
							Explore Active Hackathons
						</Link>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4">
						{filteredEvents.map((event) => (
							<div
								key={event.id}
								className="flex flex-col md:flex-row md:items-center justify-between gap-5 p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700/80 transition-all shadow-md group"
							>
								<div className="space-y-2 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span
											className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide border ${
												event.role === "judge"
													? "bg-purple-950/50 text-purple-300 border-purple-800/60"
													: event.role === "organizer"
														? "bg-amber-950/50 text-amber-300 border-amber-800/60"
														: "bg-blue-950/50 text-blue-300 border-blue-800/60"
											}`}
										>
											{event.role === "judge" ? (
												<Award className="w-3 h-3" />
											) : (
												<Users className="w-3 h-3" />
											)}
											<span>{event.role}</span>
										</span>
										<span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
											<Trophy className="w-3 h-3" />
											<span>{event.prizePool}</span>
										</span>
									</div>

									<h2 className="text-lg font-semibold text-zinc-100 group-hover:text-white transition-colors">
										{event.title}
									</h2>
									<p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
										{event.description}
									</p>
								</div>

								{/* Live Countdown & Actions */}
								<div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800/60">
									<EventCountdown
										targetDate={event.deadline}
										role={event.role}
										label={event.role === "judge" ? "Judging" : "Submissions"}
									/>
									<Link
										href={`/events/${event.id}`}
										className="inline-flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white group/btn"
									>
										<span>View Event Page</span>
										<ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover/btn:translate-x-0.5 transition-transform" />
									</Link>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</main>
	);
}
