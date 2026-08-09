import { describe, expect, it } from "vitest";
import { decidePrepare, decideSubmit } from "./idempotency";

describe("decidePrepare", () => {
	it("builds when there is no prior record", () => {
		expect(decidePrepare(null)).toEqual({ action: "build" });
	});

	it("builds when the prior attempt is still pending", () => {
		expect(decidePrepare({ status: "PENDING" })).toEqual({ action: "build" });
	});

	it("builds again when the prior attempt failed", () => {
		expect(decidePrepare({ status: "FAILED" })).toEqual({ action: "build" });
	});

	it("short-circuits once the operation has already succeeded", () => {
		expect(decidePrepare({ status: "SUCCEEDED", txHash: "abc123" })).toEqual({
			action: "already-succeeded",
			txHash: "abc123",
		});
	});
});

describe("decideSubmit", () => {
	it("throws if prepareOperation never ran for this key", () => {
		expect(() => decideSubmit(null)).toThrow(/prepareOperation must run/);
	});

	it("submits when the prior attempt is still pending", () => {
		expect(decideSubmit({ status: "PENDING" })).toEqual({ action: "submit" });
	});

	it("allows a retry after a prior failure", () => {
		expect(decideSubmit({ status: "FAILED" })).toEqual({ action: "submit" });
	});

	it("never resubmits an already-succeeded operation", () => {
		expect(decideSubmit({ status: "SUCCEEDED", txHash: "abc123" })).toEqual({
			action: "already-succeeded",
			txHash: "abc123",
		});
	});
});
