"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
	en: "EN",
	es: "ES",
};

export function LanguageSwitcher({ className }: { className?: string }) {
	const t = useTranslations("LanguageSwitcher");
	const locale = useLocale();
	const router = useRouter();
	const pathname = usePathname();

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
					className={
						l === locale
							? "rounded px-1.5 py-0.5 text-white"
							: "rounded px-1.5 py-0.5 text-white/50 hover:text-white/80"
					}
				>
					{LOCALE_LABELS[l] ?? l.toUpperCase()}
				</button>
			))}
		</fieldset>
	);
}
