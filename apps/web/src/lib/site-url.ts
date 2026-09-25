// Last resort when neither variable below is set (local dev, CI builds).
// It has to be a host that actually resolves: crawlers fetch og:image,
// sitemap and hreflang URLs from it.
export const FALLBACK_SITE_URL = "https://astrea-payouts.vercel.app";

type SiteUrlEnv = {
	NEXT_PUBLIC_APP_URL?: string;
	VERCEL_PROJECT_PRODUCTION_URL?: string;
};

// Absolute origin for metadata, robots and sitemap. An explicit
// NEXT_PUBLIC_APP_URL wins; otherwise Vercel's system variable (a bare host,
// no scheme) follows whatever domain is set as production in the dashboard.
// Default reads each variable by its literal name so Next can inline it.
export function getSiteUrl(
	env: SiteUrlEnv = {
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
	},
): string {
	const explicit = env.NEXT_PUBLIC_APP_URL?.trim();
	const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

	let url = FALLBACK_SITE_URL;
	if (explicit) url = explicit;
	else if (vercelHost) url = `https://${vercelHost}`;

	return url.replace(/\/+$/, "");
}
