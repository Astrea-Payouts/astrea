import { describe, expect, it } from "vitest";
import {
	getExplorerContractUrl,
	getExplorerTxUrl,
	truncateHash,
} from "./explorer";

describe("explorer utils", () => {
	const sampleHash =
		"6b041eb9bb62939316d9a04ad53cf5db3ce2bb9cf7bcfe21609101ad4043b27b";
	const sampleContract =
		"CDIWLY6ARVUGEJPUMWK5CZBEN4ENVAMY5NV2EGDF2EPKRGSVQTUAOIH3";

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

	describe("getExplorerContractUrl", () => {
		it("builds correct testnet contract URL", () => {
			expect(getExplorerContractUrl(sampleContract, "testnet")).toBe(
				`https://stellar.expert/explorer/testnet/contract/${sampleContract}`,
			);
		});

		it("builds correct mainnet contract URL", () => {
			expect(getExplorerContractUrl(sampleContract, "mainnet")).toBe(
				`https://stellar.expert/explorer/public/contract/${sampleContract}`,
			);
		});

		it("defaults to testnet if network is omitted", () => {
			expect(getExplorerContractUrl(sampleContract)).toBe(
				`https://stellar.expert/explorer/testnet/contract/${sampleContract}`,
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
