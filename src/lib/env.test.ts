import { afterEach, describe, expect, it, vi } from "vitest";

const VALID_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const baseEnv = {
	TW_API_KEY: "test-key",
	USDC_ISSUER: VALID_ISSUER,
};

async function loadEnvWith(overrides: Record<string, string | undefined>) {
	vi.resetModules();
	const original = { ...process.env };
	for (const key of Object.keys(process.env)) {
		if (
			key.startsWith("NEXT_PUBLIC_STELLAR_") ||
			key === "ALLOW_MAINNET" ||
			key === "TW_API_KEY" ||
			key === "TW_API_URL" ||
			key === "USDC_ISSUER" ||
			key === "USDC_SYMBOL"
		) {
			delete process.env[key];
		}
	}
	const merged = { ...baseEnv, ...overrides };
	for (const [key, value] of Object.entries(merged)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	try {
		return await import("./env");
	} finally {
		process.env = original;
	}
}

describe("env", () => {
	afterEach(() => {
		vi.resetModules();
	});

	it("throws when TW_API_KEY is missing", async () => {
		await expect(loadEnvWith({ TW_API_KEY: undefined })).rejects.toThrow(
			/TW_API_KEY/,
		);
	});

	it("throws when USDC_ISSUER is not a valid Stellar account ID", async () => {
		await expect(
			loadEnvWith({ USDC_ISSUER: "not-an-address" }),
		).rejects.toThrow(/USDC_ISSUER/);
	});

	it("defaults to testnet with the correct Horizon URL and passphrase", async () => {
		const { env } = await loadEnvWith({});
		expect(env.NEXT_PUBLIC_STELLAR_NETWORK).toBe("testnet");
		expect(env.horizonUrl).toBe("https://horizon-testnet.stellar.org");
		expect(env.networkPassphrase).toContain("Test SDF Network");
	});

	it("blocks mainnet unless ALLOW_MAINNET=true is set explicitly", async () => {
		await expect(
			loadEnvWith({ NEXT_PUBLIC_STELLAR_NETWORK: "mainnet" }),
		).rejects.toThrow(/ALLOW_MAINNET/);
	});

	it("allows mainnet once ALLOW_MAINNET=true is set, with the mainnet Horizon URL", async () => {
		const { env } = await loadEnvWith({
			NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
			ALLOW_MAINNET: "true",
		});
		expect(env.horizonUrl).toBe("https://horizon.stellar.org");
		expect(env.networkPassphrase).toContain("Public Global Stellar Network");
	});
});
