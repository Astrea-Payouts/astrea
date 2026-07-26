import { describe, expect, it } from "vitest";
import { amountToFundForExactNet, netAmountAfterFee } from "./fees";

describe("fees", () => {
	it("deducts the fixed 0.3% protocol fee (ADR-005 K01 result: 12 -> 11.964)", () => {
		expect(netAmountAfterFee(12)).toBeCloseTo(11.964, 7);
	});

	it("stacks the platform fee on top of the protocol fee", () => {
		expect(netAmountAfterFee(100, 0.02)).toBeCloseTo(97.7, 7);
	});

	it("computes the fund amount that nets exactly the target prize", () => {
		const funded = amountToFundForExactNet(500);
		expect(netAmountAfterFee(funded)).toBeCloseTo(500, 7);
	});

	it("round-trips through both directions", () => {
		const gross = 250;
		const net = netAmountAfterFee(gross, 0.01);
		expect(amountToFundForExactNet(net, 0.01)).toBeCloseTo(gross, 7);
	});
});
