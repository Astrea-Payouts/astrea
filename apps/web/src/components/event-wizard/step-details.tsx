"use client";

import { AlertCircle, Calendar, Sparkles } from "lucide-react";
import type { EventDetailsData } from "@/lib/event-wizard/types";
import { cn } from "@/lib/utils";

export interface StepDetailsProps {
	data: EventDetailsData;
	onChange: (data: EventDetailsData) => void;
	errors?: Record<string, string>;
	className?: string;
}

export function StepDetails({
	data,
	onChange,
	errors = {},
	className,
}: StepDetailsProps) {
	const handleFieldChange = (field: keyof EventDetailsData, value: string) => {
		onChange({
			...data,
			[field]: value,
		});
	};

	return (
		<div
			className={cn(
				"rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur space-y-6 md:p-8",
				className,
			)}
		>
			<div className="flex items-center gap-3">
				<div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
					<Sparkles className="size-5" />
				</div>
				<div>
					<h3 className="text-lg font-bold text-white">Event Details</h3>
					<p className="text-xs text-zinc-400">
						Configure basic event information and milestone schedule.
					</p>
				</div>
			</div>

			<div className="space-y-4">
				{/* Event Name */}
				<div className="space-y-1.5">
					<label
						htmlFor="event-name"
						className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider"
					>
						Event Name <span className="text-red-400">*</span>
					</label>
					<input
						id="event-name"
						type="text"
						value={data.name}
						onChange={(e) => handleFieldChange("name", e.target.value)}
						placeholder="e.g. Meridian Soroban DeFi Hackathon 2026"
						aria-invalid={Boolean(errors.name)}
						className={cn(
							"w-full rounded-xl border bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors",
							errors.name
								? "border-red-500/50 focus:border-red-500"
								: "border-white/10 focus:border-blue-500",
						)}
					/>
					{errors.name && (
						<div className="flex items-center gap-1 text-[11px] text-red-400">
							<AlertCircle className="size-3 shrink-0" />
							<span>{errors.name}</span>
						</div>
					)}
				</div>

				{/* Event Description */}
				<div className="space-y-1.5">
					<label
						htmlFor="event-description"
						className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider"
					>
						Description <span className="text-red-400">*</span>
					</label>
					<textarea
						id="event-description"
						rows={3}
						value={data.description}
						onChange={(e) => handleFieldChange("description", e.target.value)}
						placeholder="Summarize the theme, goals, and technical guidelines for participants..."
						aria-invalid={Boolean(errors.description)}
						className={cn(
							"w-full rounded-xl border bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors",
							errors.description
								? "border-red-500/50 focus:border-red-500"
								: "border-white/10 focus:border-blue-500",
						)}
					/>
					{errors.description && (
						<div className="flex items-center gap-1 text-[11px] text-red-400">
							<AlertCircle className="size-3 shrink-0" />
							<span>{errors.description}</span>
						</div>
					)}
				</div>

				{/* Milestone Dates Grid */}
				<div className="pt-2 border-t border-white/5 space-y-3">
					<div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
						<Calendar className="size-3.5 text-blue-400" />
						<span>Timeline & Deadlines (Strict Chronological Sequence)</span>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						{/* Date 1: Registration Close */}
						<div className="space-y-1.5">
							<label
								htmlFor="event-reg-close"
								className="block text-xs font-medium text-zinc-300"
							>
								Registration Close <span className="text-red-400">*</span>
							</label>
							<input
								id="event-reg-close"
								type="date"
								value={data.registrationCloseDate}
								onChange={(e) =>
									handleFieldChange("registrationCloseDate", e.target.value)
								}
								aria-invalid={Boolean(errors.registrationCloseDate)}
								className={cn(
									"w-full rounded-xl border bg-black/40 px-3 py-2 text-xs text-white focus:outline-none transition-colors",
									errors.registrationCloseDate
										? "border-red-500/50 focus:border-red-500"
										: "border-white/10 focus:border-blue-500",
								)}
							/>
							<p className="text-[11px] text-zinc-500">
								Last day participants can register.
							</p>
							{errors.registrationCloseDate && (
								<div className="flex items-center gap-1 text-[11px] text-red-400">
									<AlertCircle className="size-3 shrink-0" />
									<span>{errors.registrationCloseDate}</span>
								</div>
							)}
						</div>

						{/* Date 2: Submission Deadline */}
						<div className="space-y-1.5">
							<label
								htmlFor="event-sub-deadline"
								className="block text-xs font-medium text-zinc-300"
							>
								Submission Deadline <span className="text-red-400">*</span>
							</label>
							<input
								id="event-sub-deadline"
								type="date"
								value={data.submissionDeadline}
								onChange={(e) =>
									handleFieldChange("submissionDeadline", e.target.value)
								}
								aria-invalid={Boolean(errors.submissionDeadline)}
								className={cn(
									"w-full rounded-xl border bg-black/40 px-3 py-2 text-xs text-white focus:outline-none transition-colors",
									errors.submissionDeadline
										? "border-red-500/50 focus:border-red-500"
										: "border-white/10 focus:border-blue-500",
								)}
							/>
							<p className="text-[11px] text-zinc-500">
								Cutoff for submitting deliverables.
							</p>
							{errors.submissionDeadline && (
								<div className="flex items-center gap-1 text-[11px] text-red-400">
									<AlertCircle className="size-3 shrink-0" />
									<span>{errors.submissionDeadline}</span>
								</div>
							)}
						</div>

						{/* Date 3: Judging Deadline */}
						<div className="space-y-1.5">
							<label
								htmlFor="event-judg-deadline"
								className="block text-xs font-medium text-zinc-300"
							>
								Judging Deadline <span className="text-red-400">*</span>
							</label>
							<input
								id="event-judg-deadline"
								type="date"
								value={data.judgingDeadline}
								onChange={(e) =>
									handleFieldChange("judgingDeadline", e.target.value)
								}
								aria-invalid={Boolean(errors.judgingDeadline)}
								className={cn(
									"w-full rounded-xl border bg-black/40 px-3 py-2 text-xs text-white focus:outline-none transition-colors",
									errors.judgingDeadline
										? "border-red-500/50 focus:border-red-500"
										: "border-white/10 focus:border-blue-500",
								)}
							/>
							<p className="text-[11px] text-zinc-500">
								Cutoff for judges to score and pick winners.
							</p>
							{errors.judgingDeadline && (
								<div className="flex items-center gap-1 text-[11px] text-red-400">
									<AlertCircle className="size-3 shrink-0" />
									<span>{errors.judgingDeadline}</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
