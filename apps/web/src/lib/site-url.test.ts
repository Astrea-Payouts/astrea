import { describe, expect, it } from "vitest";
import { FALLBACK_SITE_URL, getSiteUrl } from "./site-url";

describe("getSiteUrl", () => {
	it("prefers NEXT_PUBLIC_APP_URL over the Vercel host", () => {
		expect(
			getSiteUrl({
				NEXT_PUBLIC_APP_URL: "https://astrea.example",
				VERCEL_PROJECT_PRODUCTION_URL: "astrea-payouts.vercel.app",
			}),
		).toBe("https://astrea.example");
	});

	it("adds the scheme to the Vercel production host", () => {
		expect(
			getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "astrea.example" }),
		).toBe("https://astrea.example");
	});

	it("falls back to the deployed Vercel URL when nothing is set", () => {
		expect(getSiteUrl({})).toBe(FALLBACK_SITE_URL);
	});

	it("treats blank values as unset", () => {
		expect(
			getSiteUrl({
				NEXT_PUBLIC_APP_URL: "  ",
				VERCEL_PROJECT_PRODUCTION_URL: "",
			}),
		).toBe(FALLBACK_SITE_URL);
	});

	it("strips trailing slashes so paths join cleanly", () => {
		expect(
			getSiteUrl({ NEXT_PUBLIC_APP_URL: "https://astrea.example//" }),
		).toBe("https://astrea.example");
	});
});
