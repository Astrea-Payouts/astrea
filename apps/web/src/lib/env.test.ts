import { afterEach, describe, expect, it, vi } from "vitest";

const VALID_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const VALID_CONTRACT_ID = `C${"A".repeat(55)}`;

const baseEnv = {
	NEXT_PUBLIC_ESCROW_CONTRACT_ID: VALID_CONTRACT_ID,
	USDC_ISSUER: VALID_ISSUER,
	CORE_GO_URL: "http://localhost:8080",
	CORE_GO_SERVICE_TOKEN: "t".repeat(32),
};

async function loadEnvWith(overrides: Record<string, string | undefined>) {
	vi.resetModules();
	const original = { ...process.env };
	for (const key of Object.keys(process.env)) {
		if (
			key.startsWith("NEXT_PUBLIC_STELLAR_") ||
			key === "NEXT_PUBLIC_ESCROW_CONTRACT_ID" ||
			key === "ALLOW_MAINNET" ||
			key === "SOROBAN_RPC_URL" ||
			key === "USDC_ISSUER" ||
			key === "USDC_SYMBOL" ||
			key === "CORE_GO_URL" ||
			key === "CORE_GO_SERVICE_TOKEN"
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
		const mod = await import("./env");
		// env parses lazily on first access; force it here so a bad config
		// rejects this call, the way the tests below expect.
		void mod.env.NEXT_PUBLIC_STELLAR_NETWORK;
		return mod;
	} finally {
		process.env = original;
	}
}

describe("env", () => {
	afterEach(() => {
		vi.resetModules();
	});

	it("throws when NEXT_PUBLIC_ESCROW_CONTRACT_ID is missing", async () => {
		await expect(
			loadEnvWith({ NEXT_PUBLIC_ESCROW_CONTRACT_ID: undefined }),
		).rejects.toThrow(/NEXT_PUBLIC_ESCROW_CONTRACT_ID/);
	});

	it("throws when NEXT_PUBLIC_ESCROW_CONTRACT_ID is malformed", async () => {
		await expect(
			loadEnvWith({ NEXT_PUBLIC_ESCROW_CONTRACT_ID: "not-a-contract-id" }),
		).rejects.toThrow(/NEXT_PUBLIC_ESCROW_CONTRACT_ID/);
	});

	it("throws when USDC_ISSUER is not a valid Stellar account ID", async () => {
		await expect(
			loadEnvWith({ USDC_ISSUER: "not-an-address" }),
		).rejects.toThrow(/USDC_ISSUER/);
	});

	it("does not parse at import time — only on first access", async () => {
		vi.resetModules();
		const original = { ...process.env };
		delete process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID;
		try {
			const mod = await import("./env");
			expect(() => mod.env.horizonUrl).toThrow(
				/NEXT_PUBLIC_ESCROW_CONTRACT_ID/,
			);
		} finally {
			process.env = original;
		}
	});

	it("treats a blank SOROBAN_RPC_URL as unset and falls back to the default", async () => {
		const { env } = await loadEnvWith({ SOROBAN_RPC_URL: "" });
		expect(env.sorobanRpcUrl).toBe("https://soroban-testnet.stellar.org");
	});

	it("throws when CORE_GO_URL is missing or not a URL", async () => {
		await expect(loadEnvWith({ CORE_GO_URL: undefined })).rejects.toThrow(
			/CORE_GO_URL/,
		);
		await expect(loadEnvWith({ CORE_GO_URL: "localhost" })).rejects.toThrow(
			/CORE_GO_URL/,
		);
	});

	it("throws when CORE_GO_SERVICE_TOKEN is missing or shorter than 32 chars", async () => {
		await expect(
			loadEnvWith({ CORE_GO_SERVICE_TOKEN: undefined }),
		).rejects.toThrow(/CORE_GO_SERVICE_TOKEN/);
		await expect(
			loadEnvWith({ CORE_GO_SERVICE_TOKEN: "short" }),
		).rejects.toThrow(/CORE_GO_SERVICE_TOKEN/);
	});

	it("defaults to testnet with the correct Horizon/Soroban RPC URL and passphrase", async () => {
		const { env } = await loadEnvWith({});
		expect(env.NEXT_PUBLIC_STELLAR_NETWORK).toBe("testnet");
		expect(env.horizonUrl).toBe("https://horizon-testnet.stellar.org");
		expect(env.sorobanRpcUrl).toBe("https://soroban-testnet.stellar.org");
		expect(env.networkPassphrase).toContain("Test SDF Network");
	});

	it("blocks mainnet unless ALLOW_MAINNET=true is set explicitly", async () => {
		await expect(
			loadEnvWith({ NEXT_PUBLIC_STELLAR_NETWORK: "mainnet" }),
		).rejects.toThrow(/ALLOW_MAINNET/);
	});

	it("blocks mainnet without an explicit SOROBAN_RPC_URL, even with ALLOW_MAINNET=true", async () => {
		await expect(
			loadEnvWith({
				NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
				ALLOW_MAINNET: "true",
			}),
		).rejects.toThrow(/SOROBAN_RPC_URL/);
	});

	it("allows mainnet once ALLOW_MAINNET=true and SOROBAN_RPC_URL are set, with the mainnet Horizon URL", async () => {
		const { env } = await loadEnvWith({
			NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
			ALLOW_MAINNET: "true",
			SOROBAN_RPC_URL: "https://mainnet.sorobanrpc.example/soroban/rpc",
		});
		expect(env.horizonUrl).toBe("https://horizon.stellar.org");
		expect(env.sorobanRpcUrl).toBe(
			"https://mainnet.sorobanrpc.example/soroban/rpc",
		);
		expect(env.networkPassphrase).toContain("Public Global Stellar Network");
	});
});
