import { describe, expect, it } from "vitest";
import { getExplorerTxUrl, truncateHash } from "@/lib/explorer";

describe("TxHashLink logic and URL builder", () => {
	const testnetHash =
		"4c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d";
	const mainnetHash =
		"9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e";

	it("generates correct stellar.expert URL for testnet", () => {
		const url = getExplorerTxUrl(testnetHash, "testnet");
		expect(url).toBe(
			`https://stellar.expert/explorer/testnet/tx/${testnetHash}`,
		);
	});

	it("generates correct stellar.expert URL for mainnet", () => {
		const url = getExplorerTxUrl(mainnetHash, "mainnet");
		expect(url).toBe(
			`https://stellar.expert/explorer/public/tx/${mainnetHash}`,
		);
	});

	it("generates correct stellar.expert URL for public", () => {
		const url = getExplorerTxUrl(mainnetHash, "public");
		expect(url).toBe(
			`https://stellar.expert/explorer/public/tx/${mainnetHash}`,
		);
	});

	it("truncates hashes with default 4 leading and 4 trailing chars", () => {
		expect(truncateHash(testnetHash)).toBe("4c1d…0c1d");
	});

	it("truncates hashes with custom length", () => {
		expect(truncateHash(testnetHash, 6, 6)).toBe("4c1d2e…9b0c1d");
	});
});
