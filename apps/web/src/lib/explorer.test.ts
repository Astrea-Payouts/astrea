import { describe, expect, it } from "vitest";
import {
	formatSmallestUnits,
	getExplorerAccountUrl,
	getExplorerContractUrl,
	getExplorerTxUrl,
	truncateHash,
} from "./explorer";

describe("explorer utils", () => {
	const sampleHash =
		"6b041eb9bb62939316d9a04ad53cf5db3ce2bb9cf7bcfe21609101ad4043b27b";

	describe("getExplorerTxUrl", () => {
		it("builds correct testnet URL", () => {
			expect(getExplorerTxUrl(sampleHash, "testnet")).toBe(
				`https://stellar.expert/explorer/testnet/tx/${sampleHash}`,
			);
		});

		it("builds correct mainnet URL", () => {
			expect(getExplorerTxUrl(sampleHash, "mainnet")).toBe(
				`https://stellar.expert/explorer/public/tx/${sampleHash}`,
			);
		});

		it("builds correct public URL", () => {
			expect(getExplorerTxUrl(sampleHash, "public")).toBe(
				`https://stellar.expert/explorer/public/tx/${sampleHash}`,
			);
		});

		it("defaults to testnet if network is omitted", () => {
			expect(getExplorerTxUrl(sampleHash)).toBe(
				`https://stellar.expert/explorer/testnet/tx/${sampleHash}`,
			);
		});
	});

	describe("truncateHash", () => {
		it("truncates standard 64-char hash", () => {
			expect(truncateHash(sampleHash)).toBe("6b04…b27b");
		});

		it("allows custom leading and trailing lengths", () => {
			expect(truncateHash(sampleHash, 6, 6)).toBe("6b041e…43b27b");
		});

		it("returns short string unmodified", () => {
			expect(truncateHash("abc")).toBe("abc");
			expect(truncateHash("12345678")).toBe("12345678");
		});

		it("handles empty string", () => {
			expect(truncateHash("")).toBe("");
		});
	});
});

describe("getExplorerContractUrl / getExplorerAccountUrl", () => {
	const contractId = "CCNAQ6MC3LZMT3U3RHVS62HEXCHTHDACSGSDKUTJUQWHGPYSAD7NFQZD";
	const account = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

	it("builds testnet contract and account URLs by default", () => {
		expect(getExplorerContractUrl(contractId)).toBe(
			`https://stellar.expert/explorer/testnet/contract/${contractId}`,
		);
		expect(getExplorerAccountUrl(account)).toBe(
			`https://stellar.expert/explorer/testnet/account/${account}`,
		);
	});

	it("maps mainnet to the public explorer", () => {
		expect(getExplorerContractUrl(contractId, "mainnet")).toBe(
			`https://stellar.expert/explorer/public/contract/${contractId}`,
		);
	});
});

describe("formatSmallestUnits", () => {
	it("formats 7-decimal amounts without going through a float", () => {
		expect(formatSmallestUnits("150000000")).toBe("15");
		expect(formatSmallestUnits("1500000")).toBe("0.15");
		expect(formatSmallestUnits("1")).toBe("0.0000001");
		expect(formatSmallestUnits("0")).toBe("0");
		expect(formatSmallestUnits("12345678901234567890")).toBe(
			"1234567890123.456789",
		);
	});

	it("honours a different decimal count", () => {
		expect(formatSmallestUnits("123456", 6)).toBe("0.123456");
		expect(formatSmallestUnits("100", 2)).toBe("1");
	});
});
