import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = getSiteUrl();
	const currentDate = new Date();

	return routing.locales.map((locale) => ({
		url: `${baseUrl}/${locale}`,
		lastModified: currentDate,
		changeFrequency: "weekly",
		priority: locale === routing.defaultLocale ? 1 : 0.9,
	}));
}
