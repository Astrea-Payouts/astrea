import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
	it("accepts a canonical UUID in either case", () => {
		expect(isUuid("11111111-2222-3333-4444-555555555555")).toBe(true);
		expect(isUuid("A1B2C3D4-E5F6-4789-ABCD-EF0123456789")).toBe(true);
		expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
	});

	it("rejects route segments that are not UUIDs", () => {
		expect(isUuid("new")).toBe(false);
		expect(isUuid("")).toBe(false);
		expect(isUuid("11111111-2222-3333-4444-55555555555")).toBe(false);
		expect(isUuid("11111111-2222-3333-4444-5555555555555")).toBe(false);
		expect(isUuid("g1111111-2222-3333-4444-555555555555")).toBe(false);
	});

	it("rejects forms Postgres would accept but routes never produce", () => {
		expect(isUuid("11111111222233334444555555555555")).toBe(false);
		expect(isUuid("{11111111-2222-3333-4444-555555555555}")).toBe(false);
		expect(isUuid(" 11111111-2222-3333-4444-555555555555")).toBe(false);
	});
});
