import { describe, expect, it } from "vitest";
import { findStalledForwards } from "./stalled-forwards";

const NOW = new Date("2026-07-26T12:00:00Z");
const THRESHOLD_MS = 5 * 60 * 1000;

describe("findStalledForwards", () => {
	it("ignores prizes that already have a forward tx hash", () => {
		const alerts = findStalledForwards(
			[
				{
					id: "p1",
					releasedAt: new Date("2026-07-26T11:00:00Z"),
					forwardTxHash: "abc",
				},
			],
			NOW,
			THRESHOLD_MS,
		);
		expect(alerts).toEqual([]);
	});

	it("ignores a prize released within the threshold window", () => {
		const alerts = findStalledForwards(
			[
				{
					id: "p1",
					releasedAt: new Date("2026-07-26T11:58:00Z"),
					forwardTxHash: null,
				},
			],
			NOW,
			THRESHOLD_MS,
		);
		expect(alerts).toEqual([]);
	});

	it("flags a prize released past the threshold with no forward yet", () => {
		const releasedAt = new Date("2026-07-26T11:00:00Z");
		const alerts = findStalledForwards(
			[{ id: "p1", releasedAt, forwardTxHash: null }],
			NOW,
			THRESHOLD_MS,
		);
		expect(alerts).toEqual([
			{ prizeId: "p1", releasedAt, pendingForMs: 60 * 60 * 1000 },
		]);
	});

	it("evaluates each prize independently", () => {
		const alerts = findStalledForwards(
			[
				{
					id: "stalled",
					releasedAt: new Date("2026-07-26T11:00:00Z"),
					forwardTxHash: null,
				},
				{
					id: "fine",
					releasedAt: new Date("2026-07-26T11:59:30Z"),
					forwardTxHash: null,
				},
				{
					id: "done",
					releasedAt: new Date("2026-07-26T10:00:00Z"),
					forwardTxHash: "xyz",
				},
			],
			NOW,
			THRESHOLD_MS,
		);
		expect(alerts.map((a) => a.prizeId)).toEqual(["stalled"]);
	});
});
