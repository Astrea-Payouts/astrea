import { Horizon } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasUsdcTrustline } from "./verify-trustline";

const PUBLIC_KEY = "GATESTACCOUNT00000000000000000000000000000000000000000";

function mockLoadAccount(impl: () => Promise<unknown>) {
	vi.spyOn(Horizon.Server.prototype, "loadAccount").mockImplementation(
		impl as unknown as Horizon.Server["loadAccount"],
	);
}

const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

// A Horizon USDC balance line; override any field per test.
function usdcLine(overrides: Record<string, unknown> = {}) {
	return {
		asset_type: "credit_alphanum4",
		asset_code: "USDC",
		asset_issuer: USDC_ISSUER,
		balance: "0.0000000",
		limit: "922337203685.4775807",
		buying_liabilities: "0.0000000",
		is_authorized: true,
		...overrides,
	};
}

describe("hasUsdcTrustline", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns true when the account holds a USDC trustline for the configured issuer", async () => {
		mockLoadAccount(() =>
			Promise.resolve({
				balances: [{ asset_type: "native", balance: "10" }, usdcLine()],
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

	// A trustline that exists but cannot receive a payment would only fail
	// later, inside the atomic release_reward.
	it.each([
		["is_authorized is false", { is_authorized: false }],
		["is_authorized is missing (fails closed)", { is_authorized: undefined }],
		["the limit is 0", { limit: "0.0000000" }],
		[
			"the balance is already at the limit",
			{ balance: "5.0000000", limit: "5.0000000" },
		],
		[
			"buying liabilities take the remaining room",
			{
				balance: "2.0000000",
				limit: "5.0000000",
				buying_liabilities: "3.0000000",
			},
		],
	])("returns false when %s", async (_name, overrides) => {
		mockLoadAccount(() => Promise.resolve({ balances: [usdcLine(overrides)] }));
		expect(await hasUsdcTrustline(PUBLIC_KEY)).toBe(false);
	});

	it("returns true with a single stroop of room left", async () => {
		mockLoadAccount(() =>
			Promise.resolve({
				balances: [
					usdcLine({
						balance: "2.0000000",
						limit: "5.0000000",
						buying_liabilities: "2.9999999",
					}),
				],
			}),
		);
		expect(await hasUsdcTrustline(PUBLIC_KEY)).toBe(true);
	});

	// Bad data from Horizon is a lookup failure, never "no trustline" (same
	// as core-go): an outage must not read as the user's problem.
	it("throws when Horizon returns a malformed amount", async () => {
		mockLoadAccount(() =>
			Promise.resolve({ balances: [usdcLine({ limit: "lots" })] }),
		);
		await expect(hasUsdcTrustline(PUBLIC_KEY)).rejects.toThrow(/lots/);
	});

	it("returns true when buying_liabilities is absent", async () => {
		mockLoadAccount(() =>
			Promise.resolve({
				balances: [usdcLine({ buying_liabilities: undefined, limit: "1" })],
			}),
		);
		expect(await hasUsdcTrustline(PUBLIC_KEY)).toBe(true);
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
