import { describe, expect, it } from "vitest";
import { parseUsdcAmount, sumUsdcAmounts } from "./amount";

describe("parseUsdcAmount", () => {
	it("scales whole and fractional amounts to stroops", () => {
		expect(parseUsdcAmount("1")).toBe(BigInt(10000000));
		expect(parseUsdcAmount("2.5")).toBe(BigInt(25000000));
		expect(parseUsdcAmount("0.0000001")).toBe(BigInt(1));
		expect(parseUsdcAmount(" 1.5 ")).toBe(BigInt(15000000));
	});

	it("rejects zero, negatives, more than 7 decimals and non-numbers", () => {
		expect(parseUsdcAmount("0")).toBeNull();
		expect(parseUsdcAmount("0.0")).toBeNull();
		expect(parseUsdcAmount("-1")).toBeNull();
		expect(parseUsdcAmount("1.00000001")).toBeNull();
		expect(parseUsdcAmount("1e3")).toBeNull();
		expect(parseUsdcAmount("")).toBeNull();
		expect(parseUsdcAmount(".5")).toBeNull();
		expect(parseUsdcAmount("1.")).toBeNull();
	});
});

describe("sumUsdcAmounts", () => {
	it("adds without float drift", () => {
		expect(sumUsdcAmounts(["1.5", "1"])).toBe(BigInt(25000000));
		expect(sumUsdcAmounts(["0.1", "0.2"])).toBe(BigInt(3000000));
	});

	it("throws on a malformed entry", () => {
		expect(() => sumUsdcAmounts(["1", "x"])).toThrow("not a USDC amount");
	});
});
