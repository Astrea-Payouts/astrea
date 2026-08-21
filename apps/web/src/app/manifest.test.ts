import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA Manifest", () => {
	it("returns a valid Web App Manifest configuration", () => {
		const result = manifest();
		expect(result.name).toBe("Astrea Payouts");
		expect(result.short_name).toBe("Astrea");
		expect(result.display).toBe("standalone");
		expect(result.theme_color).toBe("#05060d");
		expect(result.background_color).toBe("#05060d");
		expect(result.start_url).toBe("/");

		expect(result.icons).toBeDefined();
		expect(result.icons?.length).toBeGreaterThan(0);

		const icon192 = result.icons?.find((i) => i.sizes === "192x192");
		const icon512 = result.icons?.find((i) => i.sizes === "512x512");
		const iconMaskable = result.icons?.find((i) => i.purpose === "maskable");

		expect(icon192).toBeDefined();
		expect(icon512).toBeDefined();
		expect(iconMaskable).toBeDefined();
	});
});
