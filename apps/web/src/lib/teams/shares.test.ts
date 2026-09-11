import { describe, expect, it } from "vitest";
import { validateTeamShares } from "./shares";

describe("validateTeamShares", () => {
	it("accepts a solo team holding the full unit", () => {
		expect(validateTeamShares([10000])).toEqual({ valid: true });
	});

	it("accepts a multi-member team whose shares sum exactly to 10000", () => {
		expect(validateTeamShares([5000, 5000])).toEqual({ valid: true });
		expect(validateTeamShares([3334, 3333, 3333])).toEqual({ valid: true });
	});

	it("rejects a team with no members", () => {
		const result = validateTeamShares([]);
		expect(result.valid).toBe(false);
		expect(result.reason).toMatch(/at least one member/);
	});

	it("rejects shares that don't sum to exactly 10000", () => {
		const under = validateTeamShares([5000, 4000]);
		expect(under.valid).toBe(false);
		expect(under.reason).toMatch(/sum to 9000 bp/);

		const over = validateTeamShares([6000, 5000]);
		expect(over.valid).toBe(false);
		expect(over.reason).toMatch(/sum to 11000 bp/);
	});

	it("rejects a zero-share member even when the set still sums to 10000", () => {
		const result = validateTeamShares([10000, 0]);
		expect(result.valid).toBe(false);
		expect(result.reason).toMatch(/between 1 and 10000 bp, got 0/);
	});

	it("rejects a negative share", () => {
		const result = validateTeamShares([-500, 10500]);
		expect(result.valid).toBe(false);
		expect(result.reason).toMatch(/got -500/);
	});

	it("rejects a non-integer share", () => {
		const result = validateTeamShares([5000.5, 4999.5]);
		expect(result.valid).toBe(false);
		expect(result.reason).toMatch(/got 5000.5/);
	});

	it("rejects a single share above the full unit", () => {
		const result = validateTeamShares([10001]);
		expect(result.valid).toBe(false);
		expect(result.reason).toMatch(/got 10001/);
	});
});
