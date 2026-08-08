// ADR-005: Trustless Work charges a fixed, hardcoded 0.3% protocol fee per
// milestone release, confirmed against the K01 spike and TW's own whitepaper.
export const TRUSTLESS_WORK_FEE_RATE = 0.003;

export function netAmountAfterFee(
	grossAmount: number,
	platformFeeRate = 0,
): number {
	return grossAmount * (1 - TRUSTLESS_WORK_FEE_RATE - platformFeeRate);
}

// product-flows.md Flow 2: the organizer's opt-in "cover the fee" amount —
// funding this instead of the raw prize makes the winner's net receipt equal
// the advertised prize exactly.
export function amountToFundForExactNet(
	targetNetAmount: number,
	platformFeeRate = 0,
): number {
	return targetNetAmount / (1 - TRUSTLESS_WORK_FEE_RATE - platformFeeRate);
}
