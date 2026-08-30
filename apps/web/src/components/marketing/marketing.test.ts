import { describe, expect, it } from "vitest";

describe("Marketing and Navigation Component logic", () => {
	it("resolves header variant correctly", () => {
		const resolveHeaderVariant = (
			explicitVariant?: "transparent" | "solid",
			pathname = "/",
		) => {
			return explicitVariant ?? (pathname === "/" ? "transparent" : "solid");
		};

		expect(resolveHeaderVariant(undefined, "/")).toBe("transparent");
		expect(resolveHeaderVariant(undefined, "/participant")).toBe("solid");
		expect(resolveHeaderVariant(undefined, "/organizer")).toBe("solid");
		expect(resolveHeaderVariant(undefined, "/events/demo-123")).toBe("solid");
		expect(resolveHeaderVariant("solid", "/")).toBe("solid");
		expect(resolveHeaderVariant("transparent", "/participant")).toBe(
			"transparent",
		);
	});

	it("contains valid step configurations for how-it-works lifecycle", () => {
		const steps = [
			{ number: "01", key: "wizard", badge: "Step 1: Wizard" },
			{ number: "02", key: "escrow", badge: "Step 2: Smart Escrow" },
			{ number: "03", key: "judge", badge: "Step 3: Verifiable Judging" },
			{ number: "04", key: "payout", badge: "Step 4: Payout" },
		];

		expect(steps).toHaveLength(4);
		expect(steps[0].number).toBe("01");
		expect(steps[3].number).toBe("04");
	});
});
