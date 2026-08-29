import { describe, expect, it } from "vitest";
import { generateQRMatrix } from "./event-qr-code";

describe("EventQRCode Matrix Generator", () => {
	it("generates a valid square matrix for standard event URLs", () => {
		const testUrl = "https://astrea.app/events/demo-hackathon-2026";
		const matrix = generateQRMatrix(testUrl);

		expect(matrix).toBeDefined();
		expect(Array.isArray(matrix)).toBe(true);
		expect(matrix.length).toBeGreaterThanOrEqual(21);
		expect(matrix[0].length).toBe(matrix.length);
	});

	it("preserves standard 7x7 QR finder patterns in three corners", () => {
		const testUrl = "https://astrea.app/events/123";
		const matrix = generateQRMatrix(testUrl);
		const size = matrix.length;

		// Check Top-Left Finder Outer Box
		expect(matrix[0][0]).toBe(true);
		expect(matrix[0][6]).toBe(true);
		expect(matrix[6][0]).toBe(true);
		expect(matrix[6][6]).toBe(true);

		// Check Top-Right Finder Outer Box
		expect(matrix[0][size - 7]).toBe(true);
		expect(matrix[0][size - 1]).toBe(true);
		expect(matrix[6][size - 7]).toBe(true);
		expect(matrix[6][size - 1]).toBe(true);

		// Check Bottom-Left Finder Outer Box
		expect(matrix[size - 7][0]).toBe(true);
		expect(matrix[size - 7][6]).toBe(true);
		expect(matrix[size - 1][0]).toBe(true);
		expect(matrix[size - 1][6]).toBe(true);
	});

	it("produces consistent deterministic output for identical URLs", () => {
		const urlA = "https://astrea.payouts.io/events/stellar-build";
		const urlB = "https://astrea.payouts.io/events/stellar-build";

		const matrixA = generateQRMatrix(urlA);
		const matrixB = generateQRMatrix(urlB);

		expect(matrixA).toEqual(matrixB);
	});
});
