"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
	en: "EN",
	es: "ES",
};

export function LanguageSwitcher({
	className,
	variant = "dark",
}: {
	className?: string;
	/** "dark" (default) assumes a dark background (white text) — the header over the
	 *  hero. "light" assumes a light background (dark text) — e.g. inside
	 *  StaggeredMenu's white panel. */
	variant?: "dark" | "light";
}) {
	const t = useTranslations("LanguageSwitcher");
	const locale = useLocale();
	const router = useRouter();
	const pathname = usePathname();

	const activeClass =
		variant === "light"
			? "rounded px-1.5 py-0.5 text-black"
			: "rounded px-1.5 py-0.5 text-white";
	const inactiveClass =
		variant === "light"
			? "rounded px-1.5 py-0.5 text-black/50 hover:text-black/80"
			: "rounded px-1.5 py-0.5 text-white/50 hover:text-white/80";

	return (
		<fieldset
			className={`inline-flex items-center gap-1 border-0 p-0 text-xs font-medium ${className ?? ""}`}
			aria-label={t("label")}
		>
			{routing.locales.map((l) => (
				<button
					key={l}
					type="button"
					onClick={() => router.replace(pathname, { locale: l })}
					aria-current={l === locale}
					className={l === locale ? activeClass : inactiveClass}
				>
					{LOCALE_LABELS[l] ?? l.toUpperCase()}
				</button>
			))}
		</fieldset>
	);
}
