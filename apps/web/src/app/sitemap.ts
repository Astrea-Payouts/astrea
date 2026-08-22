import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://astrea.app";
	const currentDate = new Date();

	return routing.locales.map((locale) => ({
		url: `${baseUrl}/${locale}`,
		lastModified: currentDate,
		changeFrequency: "weekly",
		priority: locale === routing.defaultLocale ? 1 : 0.9,
	}));
}
