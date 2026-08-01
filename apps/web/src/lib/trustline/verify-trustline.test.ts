import { Horizon } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasUsdcTrustline } from "./verify-trustline";

const PUBLIC_KEY = "GATESTACCOUNT00000000000000000000000000000000000000000";

function mockLoadAccount(impl: () => Promise<unknown>) {
	vi.spyOn(Horizon.Server.prototype, "loadAccount").mockImplementation(
		impl as unknown as Horizon.Server["loadAccount"],
	);
}

describe("hasUsdcTrustline", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns true when the account holds a USDC trustline for the configured issuer", async () => {
		mockLoadAccount(() =>
			Promise.resolve({
				balances: [
					{ asset_type: "native", balance: "10" },
					{
						asset_type: "credit_alphanum4",
						asset_code: "USDC",
						asset_issuer:
							"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
						balance: "0",
					},
				],
			}),
		);
		expect(await hasUsdcTrustline(PUBLIC_KEY)).toBe(true);
	});

	it("returns false when the account has no matching trustline", async () => {
		mockLoadAccount(() =>
			Promise.resolve({ balances: [{ asset_type: "native", balance: "10" }] }),
		);
		expect(await hasUsdcTrustline(PUBLIC_KEY)).toBe(false);
	});

	it("returns false for a trustline to the right code but a different issuer", async () => {
		mockLoadAccount(() =>
			Promise.resolve({
				balances: [
					{
						asset_type: "credit_alphanum4",
						asset_code: "USDC",
						asset_issuer:
							"GDIFFERENTISSUER000000000000000000000000000000000000000",
						balance: "0",
					},
				],
			}),
		);
		expect(await hasUsdcTrustline(PUBLIC_KEY)).toBe(false);
	});

	it("returns false (not an error) when the account doesn't exist on the ledger yet", async () => {
		mockLoadAccount(() => Promise.reject({ response: { status: 404 } }));
		expect(await hasUsdcTrustline(PUBLIC_KEY)).toBe(false);
	});

	it("rethrows on a non-404 error", async () => {
		mockLoadAccount(() => Promise.reject({ response: { status: 500 } }));
		await expect(hasUsdcTrustline(PUBLIC_KEY)).rejects.toBeTruthy();
	});
});
