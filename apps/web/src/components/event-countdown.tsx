"use client";

import { AlertCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";

export interface TimeRemaining {
	totalMs: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	isExpired: boolean;
}

export function calculateTimeRemaining(
	target: string | Date | number,
): TimeRemaining {
	const targetTime =
		typeof target === "number" ? target : new Date(target).getTime();
	const now = Date.now();
	const totalMs = Math.max(0, targetTime - now);
	const isExpired = totalMs <= 0;

	if (isExpired) {
		return {
			totalMs: 0,
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			isExpired: true,
		};
	}

	const totalSeconds = Math.floor(totalMs / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return {
		totalMs,
		days,
		hours,
		minutes,
		seconds,
		isExpired: false,
	};
}

interface EventCountdownProps {
	targetDate: string | Date | number;
	label?: string;
	role?: "participant" | "judge" | "organizer";
	className?: string;
	onExpire?: () => void;
}

export function EventCountdown({
	targetDate,
	label = "Deadline in",
	role = "participant",
	className = "",
	onExpire,
}: EventCountdownProps) {
	const [time, setTime] = useState<TimeRemaining>(() =>
		calculateTimeRemaining(targetDate),
	);

	useEffect(() => {
		const updateCountdown = () => {
			const remaining = calculateTimeRemaining(targetDate);
			setTime(remaining);
			if (remaining.isExpired && onExpire) {
				onExpire();
			}
		};

		updateCountdown();
		const interval = setInterval(updateCountdown, 1000);
		return () => clearInterval(interval);
	}, [targetDate, onExpire]);

	const roleLabel =
		role === "judge"
			? "Judging Closes"
			: role === "organizer"
				? "Event Window"
				: "Submissions Close";

	if (time.isExpired) {
		return (
			<div
				className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 ${className}`}
				data-testid="countdown-expired"
			>
				<AlertCircle className="w-3.5 h-3.5 text-zinc-500" />
				<span>{roleLabel} Passed</span>
			</div>
		);
	}

	return (
		<div
			className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-200 text-xs shadow-sm ${className}`}
			data-testid="event-countdown"
			role="timer"
			aria-label={`${label} ${time.days} days, ${time.hours} hours, ${time.minutes} minutes, ${time.seconds} seconds`}
		>
			<div className="flex items-center gap-1 text-indigo-400 font-medium">
				<Clock className="w-3.5 h-3.5 animate-pulse" />
				<span className="text-zinc-400 text-[11px]">{label}:</span>
			</div>

			<div className="flex items-center gap-1 font-mono font-semibold tracking-tight text-zinc-100">
				{time.days > 0 && (
					<span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-indigo-300">
						{time.days}d
					</span>
				)}
				<span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
					{String(time.hours).padStart(2, "0")}h
				</span>
				<span className="text-zinc-500">:</span>
				<span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
					{String(time.minutes).padStart(2, "0")}m
				</span>
				<span className="text-zinc-500">:</span>
				<span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-indigo-400">
					{String(time.seconds).padStart(2, "0")}s
				</span>
			</div>
		</div>
	);
}

export default EventCountdown;
