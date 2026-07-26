import { describe, expect, it } from "vitest";
import { assertPrizeTransition, canTransitionPrize } from "./prize";

describe("prize state machine", () => {
	it("allows the documented happy path, including the ADR-007 forward step", () => {
		expect(canTransitionPrize("PENDING", "ASSIGNED")).toBe(true);
		expect(canTransitionPrize("ASSIGNED", "APPROVED")).toBe(true);
		expect(canTransitionPrize("APPROVED", "RELEASED")).toBe(true);
		expect(canTransitionPrize("RELEASED", "PAID_OUT")).toBe(true);
	});

	it("allows a dispute from ASSIGNED or APPROVED", () => {
		expect(canTransitionPrize("ASSIGNED", "DISPUTED")).toBe(true);
		expect(canTransitionPrize("APPROVED", "DISPUTED")).toBe(true);
	});

	it("does not allow disputing a PENDING prize (no winner assigned yet)", () => {
		expect(canTransitionPrize("PENDING", "DISPUTED")).toBe(false);
	});

	it("resolves a dispute straight to PAID_OUT, skipping RELEASED (no forwarding step)", () => {
		expect(canTransitionPrize("DISPUTED", "PAID_OUT")).toBe(true);
		expect(canTransitionPrize("DISPUTED", "RELEASED")).toBe(false);
	});

	it("rejects releasing before approval", () => {
		expect(canTransitionPrize("ASSIGNED", "RELEASED")).toBe(false);
		expect(canTransitionPrize("PENDING", "RELEASED")).toBe(false);
	});

	it("treats PAID_OUT as terminal", () => {
		expect(canTransitionPrize("PAID_OUT", "RELEASED")).toBe(false);
		expect(canTransitionPrize("PAID_OUT", "DISPUTED")).toBe(false);
	});

	it("assertPrizeTransition throws with a descriptive message on an invalid move", () => {
		expect(() => assertPrizeTransition("PENDING", "RELEASED")).toThrow(
			/Invalid Prize transition: PENDING -> RELEASED/,
		);
	});
});
