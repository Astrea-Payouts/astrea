import { describe, expect, it } from "vitest";
import { isValidIanaTimeZone } from "./iana";

describe("isValidIanaTimeZone", () => {
	it("accepts real IANA identifiers", () => {
		expect(isValidIanaTimeZone("America/Costa_Rica")).toBe(true);
		expect(isValidIanaTimeZone("America/New_York")).toBe(true);
		expect(isValidIanaTimeZone("Europe/Madrid")).toBe(true);
		expect(isValidIanaTimeZone("Asia/Tokyo")).toBe(true);
		expect(isValidIanaTimeZone("UTC")).toBe(true);
	});

	it("rejects numeric offset formats, which are not IANA identifiers", () => {
		expect(isValidIanaTimeZone("GMT+5")).toBe(false);
		expect(isValidIanaTimeZone("UTC-06:00")).toBe(false);
	});

	it("rejects garbage and unknown zones", () => {
		expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
		expect(isValidIanaTimeZone("")).toBe(false);
		expect(isValidIanaTimeZone("nonsense")).toBe(false);
	});

	it("rejects non-string input without throwing", () => {
		expect(isValidIanaTimeZone(undefined as unknown as string)).toBe(false);
		expect(isValidIanaTimeZone(null as unknown as string)).toBe(false);
	});
});
