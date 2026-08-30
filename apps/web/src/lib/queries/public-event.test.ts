import { describe, expect, it } from "vitest";
import { toExplorerNetwork } from "./public-event";

describe("public-event query helpers", () => {
	it("maps Stellar network enum to explorer network", () => {
		expect(toExplorerNetwork("TESTNET")).toBe("testnet");
		expect(toExplorerNetwork("MAINNET")).toBe("mainnet");
	});
});
