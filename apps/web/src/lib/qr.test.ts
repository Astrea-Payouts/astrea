import { describe, expect, it } from "vitest";
import { qrSvgPath } from "./qr";

describe("qrSvgPath", () => {
	it("generates an SVG path and size for a standard event URL", () => {
		const url =
			"https://astrea.app/en/events/123e4567-e89b-12d3-a456-426614174000";
		const result = qrSvgPath(url);

		expect(result.size).toBeGreaterThanOrEqual(21);
		expect(result.path).toContain("M0,0h1v1h-1z");
		expect(result.path.length).toBeGreaterThan(100);
	});

	it("keeps coordinates bounded within the module grid", () => {
		const url = "https://astrea.app/events/demo";
		const { path, size } = qrSvgPath(url);

		const matches = [...path.matchAll(/M(\d+),(\d+)h1v1h-1z/g)];
		expect(matches.length).toBeGreaterThan(0);

		for (const match of matches) {
			const x = Number.parseInt(match[1], 10);
			const y = Number.parseInt(match[2], 10);
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThan(size);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThan(size);
		}
	});

	it("produces deterministic output for the same input", () => {
		const url = "https://astrea.app/en/events/abc-xyz";
		const res1 = qrSvgPath(url);
		const res2 = qrSvgPath(url);

		expect(res1.size).toBe(res2.size);
		expect(res1.path).toBe(res2.path);
	});
});
