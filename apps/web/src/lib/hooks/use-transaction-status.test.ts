import { describe, expect, it } from "vitest";
import {
	calculateBaseProgress,
	mapOpStatusToPhase,
	type TransactionPhase,
} from "./use-transaction-status";

describe("useTransactionStatus hook utilities and lifecycle", () => {
	describe("calculateBaseProgress", () => {
		it("returns 0% for idle", () => {
			expect(calculateBaseProgress("idle")).toBe(0);
		});

		it("returns 25% for building unsigned transaction", () => {
			expect(calculateBaseProgress("building")).toBe(25);
		});

		it("returns 50% for awaiting wallet signature", () => {
			expect(calculateBaseProgress("awaiting_signature")).toBe(50);
		});

		it("returns 65% base for pending submission before race", () => {
			expect(calculateBaseProgress("pending")).toBe(65);
		});

		it("snaps to 100% only on confirmed reconciliation", () => {
			expect(calculateBaseProgress("confirmed")).toBe(100);
		});

		it("returns 0% for failed state", () => {
			expect(calculateBaseProgress("failed")).toBe(0);
		});
	});

	describe("mapOpStatusToPhase", () => {
		it("maps PENDING OpStatus to pending phase", () => {
			expect(mapOpStatusToPhase("PENDING")).toBe("pending");
		});

		it("maps SUCCEEDED OpStatus to confirmed phase", () => {
			expect(mapOpStatusToPhase("SUCCEEDED")).toBe("confirmed");
		});

		it("maps FAILED OpStatus to failed phase", () => {
			expect(mapOpStatusToPhase("FAILED")).toBe("failed");
		});
	});

	describe("State and Progress Invariants", () => {
		it("never sets confirmed progress below 100%", () => {
			const confirmedProgress = calculateBaseProgress("confirmed");
			expect(confirmedProgress).toBe(100);
		});

		it("ensures building and awaiting_signature do not exceed pending race target", () => {
			const building = calculateBaseProgress("building");
			const awaiting = calculateBaseProgress("awaiting_signature");
			const pendingBase = calculateBaseProgress("pending");

			expect(building).toBeLessThan(awaiting);
			expect(awaiting).toBeLessThan(pendingBase);
			expect(pendingBase).toBeLessThan(90);
		});

		it("ensures all phases have defined non-negative progress", () => {
			const allPhases: TransactionPhase[] = [
				"idle",
				"building",
				"awaiting_signature",
				"pending",
				"confirmed",
				"failed",
			];

			for (const phase of allPhases) {
				const progress = calculateBaseProgress(phase);
				expect(progress).toBeGreaterThanOrEqual(0);
				expect(progress).toBeLessThanOrEqual(100);
			}
		});
	});
});
