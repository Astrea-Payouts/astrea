"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<string, string> = {
	en: "EN",
	es: "ES",
};

// Text colour comes from `currentColor`, like ThemeToggle, so a caller can
// override it through className. "auto" follows the theme; "dark" and "light"
// pin it for surfaces that do not change with it (StaggeredMenu's panel is
// white in both themes).
const TEXT = {
	auto: "text-zinc-950 dark:text-white",
	dark: "text-white",
	light: "text-black",
} as const;

// Width of one option. The track is this times the number of locales, so two
// locales come out at the same 3.5rem as ThemeToggle's pill.
const CELL_REM = 1.75;

// Each language is named in its own language ("English", "español"), which
// needs no translation keys and reads correctly whatever the page language is.
function languageName(locale: string): string {
	try {
		return (
			new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale
		);
	} catch {
		return locale;
	}
}

/**
 * Language switch with the same pill as ThemeToggle. The whole pill is one
 * button: a click anywhere on it moves to the next language, which with two
 * languages is simply the other one.
 */
export function LanguageSwitcher({
	className,
	variant = "auto",
}: {
	className?: string;
	/** "auto" (default) follows the theme. "dark" assumes a dark background
	 *  (white text) and "light" a light one (dark text) — e.g. inside
	 *  StaggeredMenu's white panel — whatever the theme. */
	variant?: "auto" | "dark" | "light";
}) {
	const t = useTranslations("LanguageSwitcher");
	const locale = useLocale();
	const router = useRouter();
	const pathname = usePathname();

	// The locale only changes once the navigation has landed, which is a server
	// round trip away. Without this the thumb would sit still after a click and
	// then jump. `from` ties the pending choice to the locale it was made from,
	// so it stops applying by itself the moment the locale changes.
	const [pending, setPending] = useState<{ from: string; to: string } | null>(
		null,
	);
	const active = pending?.from === locale ? pending.to : locale;

	const locales = routing.locales;
	const count = locales.length;
	const activeIndex = Math.max(
		0,
		(locales as readonly string[]).indexOf(active),
	);

	const cycle = () => {
		const next = locales[(activeIndex + 1) % count] ?? locales[0];
		setPending({ from: locale, to: next });
		router.replace(pathname, { locale: next });
	};

	return (
		<button
			type="button"
			onClick={cycle}
			// One control, so its name is the current language; the labels inside
			// are presentational.
			aria-label={`${t("label")}: ${languageName(active)}`}
			title={t("label")}
			className={cn(
				"relative grid h-7 cursor-pointer rounded-full border border-current/30 p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2",
				TEXT[variant],
				className,
			)}
			style={{
				width: `${count * CELL_REM}rem`,
				gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
			}}
		>
			{/* The thumb sits behind the labels and slides to the active one. Its
			width is one cell: the padding box minus the 0.25rem of padding, split
			between the options. */}
			<span
				aria-hidden="true"
				className="absolute inset-y-0.5 left-0.5 rounded-full bg-current/20 transition-transform duration-300 motion-reduce:transition-none"
				style={{
					width: `calc((100% - 0.25rem) / ${count})`,
					transform: `translateX(${activeIndex * 100}%)`,
				}}
			/>
			{locales.map((l) => (
				<span
					key={l}
					aria-hidden="true"
					className={cn(
						"relative flex items-center justify-center text-[0.6875rem] leading-none font-semibold tracking-wide transition-opacity motion-reduce:transition-none",
						l === active ? "opacity-100" : "opacity-50",
					)}
				>
					{LOCALE_LABELS[l] ?? l.toUpperCase()}
				</span>
			))}
		</button>
	);
}
