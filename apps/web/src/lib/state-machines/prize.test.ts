import { describe, expect, it } from "vitest";
import { assertPrizeTransition, canTransitionPrize } from "./prize";

describe("prize state machine", () => {
	it("allows the documented happy path — no approval step, release_reward pays directly", () => {
		expect(canTransitionPrize("PENDING", "ASSIGNED")).toBe(true);
		expect(canTransitionPrize("ASSIGNED", "RELEASED")).toBe(true);
		expect(canTransitionPrize("RELEASED", "PAID_OUT")).toBe(true);
	});

	it("allows a dispute from ASSIGNED", () => {
		expect(canTransitionPrize("ASSIGNED", "DISPUTED")).toBe(true);
	});

	it("does not allow disputing a PENDING prize (no winner assigned yet)", () => {
		expect(canTransitionPrize("PENDING", "DISPUTED")).toBe(false);
	});

	it("resolves a dispute straight to PAID_OUT, skipping RELEASED (no forwarding step)", () => {
		expect(canTransitionPrize("DISPUTED", "PAID_OUT")).toBe(true);
		expect(canTransitionPrize("DISPUTED", "RELEASED")).toBe(false);
	});

	it("rejects releasing a prize with no winner assigned yet", () => {
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
