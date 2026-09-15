// Decimal USDC amounts ⇄ stroops (7 decimals), as BigInt so a sum of Prize
// rows never goes through a float. Client-safe: no env, no sdk. Mirrors
// services/core-go/internal/escrow/amount.go AmountToStroops — digits, an
// optional fraction of at most 7 places, strictly positive.

export const USDC_DECIMALS = 7;
const SCALE = BigInt(10) ** BigInt(USDC_DECIMALS);
const DECIMAL = /^(\d+)(?:\.(\d{1,7}))?$/;

/** "2.5" → 25000000 as bigint; null when the string is not a positive USDC amount. */
export function parseUsdcAmount(raw: string): bigint | null {
	const m = DECIMAL.exec(raw.trim());
	if (!m) return null;
	const whole = BigInt(m[1]);
	const frac = m[2] ? BigInt(m[2].padEnd(USDC_DECIMALS, "0")) : BigInt(0);
	const stroops = whole * SCALE + frac;
	return stroops > BigInt(0) ? stroops : null;
}

/** Sum of decimal amounts in stroops; throws on a malformed entry. */
export function sumUsdcAmounts(amounts: string[]): bigint {
	return amounts.reduce((acc, a) => {
		const v = parseUsdcAmount(a);
		if (v === null) throw new Error(`not a USDC amount: ${a}`);
		return acc + v;
	}, BigInt(0));
}
