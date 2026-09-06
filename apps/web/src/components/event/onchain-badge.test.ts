import { describe, expect, it } from "vitest";
import { getExplorerContractUrl, truncateHash } from "@/lib/explorer";

describe("OnchainBadge logic and URL resolver", () => {
	const sampleContract =
		"CDIWLY6ARVUGEJPUMWK5CZBEN4ENVAMY5NV2EGDF2EPKRGSVQTUAOIH3";

	it("generates correct explorer URL for testnet contract", () => {
		const url = getExplorerContractUrl(sampleContract, "testnet");
		expect(url).toBe(
			`https://stellar.expert/explorer/testnet/contract/${sampleContract}`,
		);
	});

	it("generates correct explorer URL for mainnet contract", () => {
		const url = getExplorerContractUrl(sampleContract, "mainnet");
		expect(url).toBe(
			`https://stellar.expert/explorer/public/contract/${sampleContract}`,
		);
	});

	it("formats truncated contract address", () => {
		expect(truncateHash(sampleContract, 4, 4)).toBe("CDIW…OIH3");
	});
});
