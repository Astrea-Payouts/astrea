"use client";

import { Zap, ZapOff } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	preferenceForToggle,
	useMotionPreference,
} from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

export interface ReduceMotionToggleProps {
	/**
	 * "icon" is for the desktop header row, which is already dense. "labelled"
	 * is for the mobile menu panel and the footer, where there is room to say
	 * what the control does.
	 */
	variant?: "icon" | "labelled";
	className?: string;
}

/**
 * Lets a visitor override the OS reduced-motion preference in either
 * direction.
 *
 * The OS setting is the default, not the verdict — people switch Windows'
 * animation effects off for battery or taste, and people leave the OS alone
 * while still wanting a marketing page to hold still. See docs/ui-motion.md.
 */
export function ReduceMotionToggle({
	variant = "icon",
	className,
}: ReduceMotionToggleProps) {
	const t = useTranslations("Motion");
	const { preference, setPreference, reduced } = useMotionPreference();

	const toggle = () => setPreference(preferenceForToggle(!reduced));
	const Icon = reduced ? ZapOff : Zap;
	const stateLabel = reduced ? t("reducedState") : t("fullState");

	if (variant === "icon") {
		return (
			<button
				type="button"
				role="switch"
				aria-checked={reduced}
				aria-label={t("label")}
				title={`${t("label")} — ${stateLabel}`}
				onClick={toggle}
				className={cn(
					"rounded-md p-1 transition-colors hover:text-white",
					reduced ? "text-white" : "text-white/70",
					className,
				)}
			>
				<Icon className="size-5" aria-hidden="true" />
			</button>
		);
	}

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<button
				type="button"
				role="switch"
				aria-checked={reduced}
				onClick={toggle}
				className="flex items-center justify-between gap-3 rounded-md text-sm font-medium"
			>
				<span className="flex items-center gap-2">
					<Icon className="size-4" aria-hidden="true" />
					{t("label")}
				</span>
				{/* Presentational: the button itself carries the switch semantics. */}
				<span
					aria-hidden="true"
					className={cn(
						"relative h-5 w-9 shrink-0 rounded-full border transition-colors",
						reduced
							? "border-current bg-current/25"
							: "border-current/40 bg-transparent",
					)}
				>
					<span
						className={cn(
							"absolute top-0.5 size-3.5 rounded-full bg-current transition-all",
							reduced ? "left-[1.125rem]" : "left-0.5 opacity-60",
						)}
					/>
				</span>
			</button>
			{preference === "system" ? (
				<span className="text-xs opacity-60">{t("followingSystem")}</span>
			) : (
				<button
					type="button"
					onClick={() => setPreference("system")}
					className="self-start text-xs underline underline-offset-2 opacity-60 hover:opacity-100"
				>
					{t("useSystem")}
				</button>
			)}
		</div>
	);
}
