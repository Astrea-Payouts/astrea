"use client";

import {
	ArrowRight,
	Calendar,
	CheckCircle,
	Clock,
	Coins,
	Filter,
	Gavel,
	Layers,
	Search,
	ShieldCheck,
	Sparkles,
	Trophy,
	Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EventCountdown } from "@/components/event-countdown";
import {
	NoEventsFoundState,
	WalletNotConnectedState,
} from "@/components/my-events/empty-state";
import { Link } from "@/i18n/navigation";
import { summarizeMyEvents } from "@/lib/my-events/deadline";
import type {
	EventRole,
	MyEventItem,
	RoleFilterOption,
	StatusFilterOption,
} from "@/lib/my-events/types";
import { useWallet } from "@/lib/wallet/provider";

interface MyEventsDashboardProps {
	initialEvents: MyEventItem[];
	sessionWalletAddress: string | null;
}

export function MyEventsDashboard({
	initialEvents,
	sessionWalletAddress,
}: MyEventsDashboardProps) {
	const t = useTranslations("MyEvents");
	const { address: connectedAddress } = useWallet();

	// Effective address: prefer client wallet if connected, fallback to session
	const activeAddress = connectedAddress || sessionWalletAddress;

	const [roleFilter, setRoleFilter] = useState<RoleFilterOption>("ALL");
	const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("ALL");
	const [searchQuery, setSearchQuery] = useState("");

	// Filtered list of events
	const filteredEvents = useMemo(() => {
		return initialEvents.filter((evt) => {
			// Role filtering
			if (
				roleFilter !== "ALL" &&
				!evt.roles.includes(roleFilter as EventRole)
			) {
				return false;
			}

			// Status filtering
			if (statusFilter === "ACTIVE") {
				if (
					evt.status !== "LIVE" &&
					evt.status !== "JUDGING" &&
					evt.status !== "FUNDED"
				) {
					return false;
				}
			} else if (statusFilter === "COMPLETED") {
				if (evt.status !== "COMPLETED") return false;
			} else if (statusFilter === "CANCELLED") {
				if (evt.status !== "CANCELLED") return false;
			}

			// Search query
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const matchName = evt.name.toLowerCase().includes(q);
				const matchDesc = evt.description?.toLowerCase().includes(q) ?? false;
				if (!matchName && !matchDesc) return false;
			}

			return true;
		});
	}, [initialEvents, roleFilter, statusFilter, searchQuery]);

	// Calculate counts per role for tab badges
	const roleCounts = useMemo(() => {
		return {
			ALL: initialEvents.length,
			PARTICIPANT: initialEvents.filter((e) => e.roles.includes("PARTICIPANT"))
				.length,
			JUDGE: initialEvents.filter((e) => e.roles.includes("JUDGE")).length,
			ORGANIZER: initialEvents.filter((e) => e.roles.includes("ORGANIZER"))
				.length,
		};
	}, [initialEvents]);

	const summary = useMemo(
		() => summarizeMyEvents(initialEvents),
		[initialEvents],
	);

	if (!activeAddress) {
		return <WalletNotConnectedState />;
	}

	return (
		<div className="space-y-8">
			{/* Top Summary Metrics */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
					<div className="flex items-center justify-between text-zinc-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							{t("metricTotalEvents")}
						</span>
						<Calendar className="size-4 text-blue-400" />
					</div>
					<div className="mt-3 text-3xl font-bold text-white">
						{summary.totalEvents}
					</div>
					<div className="mt-1 text-xs text-zinc-500">
						{t("metricTotalDesc")}
					</div>
				</div>

				<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
					<div className="flex items-center justify-between text-zinc-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							{t("metricActiveEvents")}
						</span>
						<Sparkles className="size-4 text-emerald-400" />
					</div>
					<div className="mt-3 text-3xl font-bold text-emerald-400">
						{summary.activeCount}
					</div>
					<div className="mt-1 text-xs text-zinc-500">
						{t("metricActiveDesc")}
					</div>
				</div>

				<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
					<div className="flex items-center justify-between text-zinc-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							{t("metricTotalPrize")}
						</span>
						<Coins className="size-4 text-amber-400" />
					</div>
					<div className="mt-3 text-3xl font-bold text-white">
						${summary.totalPrizeUsdc}
					</div>
					<div className="mt-1 text-xs text-zinc-500">
						{t("metricUsdcDesc")}
					</div>
				</div>

				<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
					<div className="flex items-center justify-between text-zinc-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							{t("metricNextDeadline")}
						</span>
						<Clock className="size-4 text-sky-400" />
					</div>
					<div className="mt-2">
						{summary.nextClosestDeadline ? (
							<EventCountdown
								targetDate={summary.nextClosestDeadline.targetDate}
								variant="badge"
								label={t(summary.nextClosestDeadline.labelKey)}
								className="mt-1"
							/>
						) : (
							<span className="text-sm text-zinc-500">{t("noDeadlines")}</span>
						)}
					</div>
					<div className="mt-1 text-xs text-zinc-500">
						{summary.nextClosestDeadline
							? t(summary.nextClosestDeadline.labelKey)
							: t("allConcluded")}
					</div>
				</div>
			</div>

			{/* Filter Toolbar */}
			<div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
				{/* Role Tabs */}
				<div className="flex flex-wrap items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5">
					<button
						type="button"
						onClick={() => setRoleFilter("ALL")}
						className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
							roleFilter === "ALL"
								? "bg-white text-black shadow"
								: "text-zinc-400 hover:text-white"
						}`}
					>
						{t("tabAll")} ({roleCounts.ALL})
					</button>
					<button
						type="button"
						onClick={() => setRoleFilter("PARTICIPANT")}
						className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
							roleFilter === "PARTICIPANT"
								? "bg-blue-600 text-white shadow"
								: "text-zinc-400 hover:text-white"
						}`}
					>
						<Trophy className="size-3" />
						{t("tabParticipant")} ({roleCounts.PARTICIPANT})
					</button>
					<button
						type="button"
						onClick={() => setRoleFilter("JUDGE")}
						className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
							roleFilter === "JUDGE"
								? "bg-purple-600 text-white shadow"
								: "text-zinc-400 hover:text-white"
						}`}
					>
						<Gavel className="size-3" />
						{t("tabJudge")} ({roleCounts.JUDGE})
					</button>
					<button
						type="button"
						onClick={() => setRoleFilter("ORGANIZER")}
						className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
							roleFilter === "ORGANIZER"
								? "bg-emerald-600 text-white shadow"
								: "text-zinc-400 hover:text-white"
						}`}
					>
						<Layers className="size-3" />
						{t("tabOrganizer")} ({roleCounts.ORGANIZER})
					</button>
				</div>

				{/* Search & Status Filter */}
				<div className="flex items-center gap-3">
					<div className="relative flex-1 sm:w-60">
						<Search className="absolute left-3 top-2.5 size-4 text-zinc-500" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={t("searchPlaceholder")}
							className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
						/>
					</div>

					<div className="relative flex items-center">
						<Filter className="absolute left-3 size-3 text-zinc-500 pointer-events-none" />
						<select
							value={statusFilter}
							onChange={(e) =>
								setStatusFilter(e.target.value as StatusFilterOption)
							}
							className="rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 py-1.5 text-xs text-zinc-300 focus:border-blue-500 focus:outline-none cursor-pointer"
						>
							<option value="ALL">{t("statusAll")}</option>
							<option value="ACTIVE">{t("statusActive")}</option>
							<option value="COMPLETED">{t("statusCompletedOption")}</option>
							<option value="CANCELLED">{t("statusCancelledOption")}</option>
						</select>
					</div>
				</div>
			</div>

			{/* Event Cards List */}
			{filteredEvents.length === 0 ? (
				<NoEventsFoundState
					walletAddress={activeAddress}
					filterRole={roleFilter}
				/>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{filteredEvents.map((evt) => (
						<EventCard key={evt.id} event={evt} />
					))}
				</div>
			)}
		</div>
	);
}

function EventCard({ event }: { event: MyEventItem }) {
	const t = useTranslations("MyEvents");

	return (
		<div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur transition-all hover:border-white/20 hover:shadow-xl">
			<div>
				{/* Status & Roles Header */}
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<StatusBadge status={event.status} />
						{event.roles.map((role) => (
							<RoleBadge key={role} role={role} />
						))}
					</div>

					<div className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
						<Coins className="size-3.5" />
						<span>${event.totalPrizeUsdc} USDC</span>
					</div>
				</div>

				{/* Event Title & Description */}
				<h3 className="mt-4 font-serif text-xl font-bold tracking-tight text-white line-clamp-1">
					{event.name}
				</h3>
				<p className="mt-2 text-xs leading-relaxed text-zinc-400 line-clamp-2">
					{event.description ?? t("noDescription")}
				</p>

				{/* Contract Badge & Meta */}
				<div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500 border-y border-white/5 py-2.5">
					<div className="flex items-center gap-1.5">
						<Users className="size-3.5 text-zinc-400" />
						<span>{event.participantCount} registered</span>
					</div>

					{event.escrowContractId && (
						<div className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
							<ShieldCheck className="size-3.5 text-blue-400" />
							<span>{event.escrowContractId}</span>
						</div>
					)}
				</div>

				{/* Live Countdown Component */}
				<div className="mt-4">
					<EventCountdown
						targetDate={event.nextDeadline.targetDate}
						label={t(event.nextDeadline.labelKey)}
						variant="card"
					/>
				</div>
			</div>

			{/* Action Links Footer */}
			<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
				<Link
					href={`/events/${event.id}`}
					className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
				>
					{t("viewEventAction")} <ArrowRight className="size-3.5" />
				</Link>

				<div className="flex items-center gap-2">
					{event.roles.includes("JUDGE") && event.status === "JUDGING" && (
						<Link
							href={`/events/${event.id}`}
							className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 px-3 py-1.5 text-xs font-semibold text-purple-300 transition-all hover:bg-purple-600/30"
						>
							<Gavel className="size-3" />
							{t("judgePanelAction")}
						</Link>
					)}

					{event.roles.includes("PARTICIPANT") && event.status === "LIVE" && (
						<Link
							href={`/events/${event.id}`}
							className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-blue-500"
						>
							<CheckCircle className="size-3" />
							{t("submitProjectAction")}
						</Link>
					)}

					{event.roles.includes("ORGANIZER") && (
						<Link
							href="/organizer"
							className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-white/10"
						>
							<Layers className="size-3" />
							{t("organizerDashboardAction")}
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: MyEventItem["status"] }) {
	const t = useTranslations("MyEvents");

	switch (status) {
		case "LIVE":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
					<span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
					{t("statusLive")}
				</span>
			);
		case "JUDGING":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
					<span className="size-1.5 rounded-full bg-amber-400" />
					{t("statusJudging")}
				</span>
			);
		case "FUNDED":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400">
					{t("statusFunded")}
				</span>
			);
		case "COMPLETED":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
					{t("statusCompleted")}
				</span>
			);
		case "CANCELLED":
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-400">
					{t("statusCancelled")}
				</span>
			);
		default:
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
					{status}
				</span>
			);
	}
}

function RoleBadge({ role }: { role: EventRole }) {
	const t = useTranslations("MyEvents");

	switch (role) {
		case "PARTICIPANT":
			return (
				<span className="inline-flex items-center gap-1 rounded bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-300 uppercase tracking-wider">
					{t("roleParticipant")}
				</span>
			);
		case "JUDGE":
			return (
				<span className="inline-flex items-center gap-1 rounded bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
					{t("roleJudge")}
				</span>
			);
		case "ORGANIZER":
			return (
				<span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
					{t("roleOrganizer")}
				</span>
			);
	}
}
