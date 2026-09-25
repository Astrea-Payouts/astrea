"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export interface ThemeToggleProps {
	/**
	 * "switch" is the bare pill, small enough for the desktop header row: the
	 * sun and moon say what it does, so it needs no text. "labelled" adds the
	 * text for the mobile menu panel and the footer, where there is room.
	 */
	variant?: "switch" | "labelled";
	className?: string;
}

// Colours come from `currentColor`, so the caller decides them through
// className (white in the header, black in the mobile panel).
function SwitchTrack({ isDark }: { isDark: boolean }) {
	return (
		<span
			aria-hidden="true"
			className="relative grid h-7 w-14 shrink-0 grid-cols-2 items-center rounded-full border border-current/30 p-0.5"
		>
			{/* The thumb sits behind the icons and slides to the active side. */}
			<span
				className={cn(
					"absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-current/20 transition-transform duration-300 motion-reduce:transition-none",
					isDark && "translate-x-full",
				)}
			/>
			<Sun
				className={cn(
					"relative mx-auto size-4 transition-opacity motion-reduce:transition-none",
					isDark ? "opacity-50" : "opacity-100",
				)}
			/>
			<Moon
				className={cn(
					"relative mx-auto size-4 transition-opacity motion-reduce:transition-none",
					isDark ? "opacity-100" : "opacity-50",
				)}
			/>
		</span>
	);
}

/**
 * Switches between the dark and light theme. Dark is on when the switch is to
 * the right, on the moon.
 */
export function ThemeToggle({
	variant = "switch",
	className,
}: ThemeToggleProps) {
	const t = useTranslations("Theme");
	const { theme, setTheme } = useTheme();
	const isDark = theme === "dark";

	const toggle = () => setTheme(isDark ? "light" : "dark");

	if (variant === "labelled") {
		return (
			<button
				type="button"
				role="switch"
				aria-checked={isDark}
				onClick={toggle}
				className={cn(
					"flex items-center justify-between gap-3 rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
					className,
				)}
			>
				<span>{t("label")}</span>
				<SwitchTrack isDark={isDark} />
			</button>
		);
	}

	return (
		<button
			type="button"
			role="switch"
			aria-checked={isDark}
			aria-label={t("label")}
			title={t("label")}
			onClick={toggle}
			className={cn(
				"rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
				className,
			)}
		>
			<SwitchTrack isDark={isDark} />
		</button>
	);
}
