import { describe, expect, it } from "vitest";
import { assertEventTransition, canTransitionEvent } from "./event";

describe("event state machine", () => {
	it("allows the documented happy path", () => {
		expect(canTransitionEvent("DRAFT", "CREATED")).toBe(true);
		expect(canTransitionEvent("CREATED", "FUNDED")).toBe(true);
		expect(canTransitionEvent("FUNDED", "LIVE")).toBe(true);
		expect(canTransitionEvent("LIVE", "JUDGING")).toBe(true);
		expect(canTransitionEvent("JUDGING", "COMPLETED")).toBe(true);
	});

	it("allows cancellation from any state that already has an escrow", () => {
		expect(canTransitionEvent("CREATED", "CANCELLED")).toBe(true);
		expect(canTransitionEvent("FUNDED", "CANCELLED")).toBe(true);
		expect(canTransitionEvent("LIVE", "CANCELLED")).toBe(true);
		expect(canTransitionEvent("JUDGING", "CANCELLED")).toBe(true);
	});

	it("does not allow cancelling a DRAFT event (no escrow exists yet)", () => {
		expect(canTransitionEvent("DRAFT", "CANCELLED")).toBe(false);
	});

	it("rejects skipping states", () => {
		expect(canTransitionEvent("DRAFT", "LIVE")).toBe(false);
		expect(canTransitionEvent("CREATED", "JUDGING")).toBe(false);
	});

	it("treats COMPLETED and CANCELLED as terminal", () => {
		expect(canTransitionEvent("COMPLETED", "LIVE")).toBe(false);
		expect(canTransitionEvent("CANCELLED", "LIVE")).toBe(false);
	});

	it("assertEventTransition throws with a descriptive message on an invalid move", () => {
		expect(() => assertEventTransition("DRAFT", "COMPLETED")).toThrow(
			/Invalid Event transition: DRAFT -> COMPLETED/,
		);
	});

	it("assertEventTransition does not throw on a valid move", () => {
		expect(() => assertEventTransition("LIVE", "JUDGING")).not.toThrow();
	});
});
