import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	it("joins plain class names", () => {
		expect(cn("a", "b")).toBe("a b");
	});

	it("drops falsy values", () => {
		expect(cn("a", false, undefined, null, "b")).toBe("a b");
	});

	it("resolves conflicting Tailwind utilities, last one wins", () => {
		expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
	});
});
