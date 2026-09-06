"use client";

import { AlertCircle, CheckCircle2, Clock, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
	formatRemainingTime,
	formatTimezoneDetails,
	parseRemainingTime,
} from "@/lib/my-events/deadline";
import type { RemainingTime } from "@/lib/my-events/types";

interface EventCountdownProps {
	targetDate: string | Date;
	label?: string;
	variant?: "card" | "badge" | "hero";
	showTimezone?: boolean;
	className?: string;
	onExpire?: () => void;
}

export function EventCountdown({
	targetDate,
	label,
	variant = "card",
	showTimezone = true,
	className = "",
	onExpire,
}: EventCountdownProps) {
	const t = useTranslations("MyEvents");
	const [hasMounted, setHasMounted] = useState(false);
	const [remaining, setRemaining] = useState<RemainingTime>(() =>
		parseRemainingTime(targetDate),
	);

	// Client-side ticking interval every 1 second
	useEffect(() => {
		setHasMounted(true);
		const interval = setInterval(() => {
			const updated = parseRemainingTime(targetDate);
			setRemaining(updated);
			if (updated.isExpired && onExpire) {
				onExpire();
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [targetDate, onExpire]);

	const timezoneDetails = useMemo(() => {
		const iso =
			targetDate instanceof Date ? targetDate.toISOString() : targetDate;
		return formatTimezoneDetails(iso);
	}, [targetDate]);

	const formattedDuration = useMemo(
		() => formatRemainingTime(remaining),
		[remaining],
	);

	// Compact badge variant
	if (variant === "badge") {
		if (remaining.isExpired) {
			return (
				<span
					className={`inline-flex items-center gap-1.5 rounded-md bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-400 ${className}`}
				>
					<CheckCircle2 className="size-3 text-zinc-500" />
					<span>{t("concludedBadge")}</span>
				</span>
			);
		}

		return (
			<span
				className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
					remaining.isUrgent
						? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
						: "bg-blue-500/10 text-blue-400 border border-blue-500/20"
				} ${className}`}
				role="timer"
				aria-label={`${label ?? t("deadlineCountdown")}: ${formattedDuration}`}
			>
				<Clock
					className={`size-3 ${remaining.isUrgent ? "animate-pulse text-amber-400" : "text-blue-400"}`}
				/>
				<span className="font-mono tabular-nums">{formattedDuration}</span>
			</span>
		);
	}

	// Hero variant (large countdown blocks)
	if (variant === "hero") {
		return (
			<div
				className={`rounded-2xl border border-white/10 bg-zinc-900/80 p-6 backdrop-blur ${className}`}
				role="timer"
				aria-label={label ?? t("deadlineCountdown")}
			>
				{label && (
					<div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-400">
						<span className="flex items-center gap-1.5">
							<Clock className="size-3.5 text-blue-400" />
							{label}
						</span>
						{remaining.isUrgent && !remaining.isExpired && (
							<span className="flex items-center gap-1 text-amber-400 text-[11px] font-semibold">
								<AlertCircle className="size-3 animate-pulse" />
								{t("urgentNotice")}
							</span>
						)}
					</div>
				)}

				<div className="mt-4 grid grid-cols-4 gap-2 text-center">
					<div className="rounded-lg bg-black/40 border border-white/5 p-2.5">
						<div className="text-2xl font-bold font-mono text-white">
							{hasMounted ? remaining.days : "--"}
						</div>
						<div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">
							{t("unitDays")}
						</div>
					</div>
					<div className="rounded-lg bg-black/40 border border-white/5 p-2.5">
						<div className="text-2xl font-bold font-mono text-white">
							{hasMounted ? remaining.hours : "--"}
						</div>
						<div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">
							{t("unitHours")}
						</div>
					</div>
					<div className="rounded-lg bg-black/40 border border-white/5 p-2.5">
						<div className="text-2xl font-bold font-mono text-white">
							{hasMounted ? remaining.minutes : "--"}
						</div>
						<div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">
							{t("unitMins")}
						</div>
					</div>
					<div className="rounded-lg bg-black/40 border border-white/5 p-2.5">
						<div className="text-2xl font-bold font-mono text-white">
							{hasMounted ? remaining.seconds : "--"}
						</div>
						<div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">
							{t("unitSecs")}
						</div>
					</div>
				</div>

				{showTimezone && (
					<div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500 border-t border-white/5 pt-2.5">
						<span className="flex items-center gap-1">
							<Globe className="size-3 text-zinc-400" />
							{timezoneDetails.formattedDate}
						</span>
						<span className="text-[10px] font-mono text-zinc-500">
							{timezoneDetails.utc}
						</span>
					</div>
				)}
			</div>
		);
	}

	// Default "card" variant
	return (
		<div
			className={`flex flex-col gap-1.5 rounded-xl border p-3.5 transition-colors ${
				remaining.isExpired
					? "border-zinc-800 bg-zinc-900/40 text-zinc-400"
					: remaining.isUrgent
						? "border-amber-500/30 bg-amber-950/15 text-white"
						: "border-blue-500/20 bg-blue-950/15 text-white"
			} ${className}`}
			role="timer"
			aria-label={`${label ?? t("deadlineCountdown")}: ${formattedDuration}`}
		>
			<div className="flex items-center justify-between text-xs font-medium">
				<span className="flex items-center gap-1.5 text-zinc-400">
					<Clock
						className={`size-3.5 ${
							remaining.isExpired
								? "text-zinc-500"
								: remaining.isUrgent
									? "text-amber-400 animate-pulse"
									: "text-blue-400"
						}`}
					/>
					{label ?? t("deadlineRemaining")}
				</span>

				{remaining.isUrgent && !remaining.isExpired && (
					<span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
						{t("urgentTag")}
					</span>
				)}
			</div>

			<div className="flex items-baseline justify-between gap-2 mt-1">
				<div className="font-mono text-lg font-bold tracking-tight text-white">
					{hasMounted ? formattedDuration : "..."}
				</div>

				{showTimezone && (
					<span
						className="text-[11px] text-zinc-500 font-sans"
						title={timezoneDetails.utc}
					>
						{timezoneDetails.formattedDate}
					</span>
				)}
			</div>
		</div>
	);
}
