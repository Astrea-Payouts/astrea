import { Horizon } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isTransactionConfirmed } from "./transaction-confirmation";

function mockTransactionCall(impl: () => Promise<unknown>) {
	vi.spyOn(Horizon.Server.prototype, "transactions").mockReturnValue({
		transaction: () => ({ call: impl }),
	} as unknown as ReturnType<Horizon.Server["transactions"]>);
}

describe("isTransactionConfirmed", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns true when Horizon has the transaction", async () => {
		mockTransactionCall(() => Promise.resolve({ successful: true }));
		expect(await isTransactionConfirmed("abc123")).toBe(true);
	});

	it("returns false when Horizon responds 404 (never landed)", async () => {
		mockTransactionCall(() => Promise.reject({ response: { status: 404 } }));
		expect(await isTransactionConfirmed("missing")).toBe(false);
	});

	it("rethrows on a non-404 error instead of treating it as unconfirmed", async () => {
		mockTransactionCall(() => Promise.reject({ response: { status: 500 } }));
		await expect(isTransactionConfirmed("boom")).rejects.toBeTruthy();
	});
});
