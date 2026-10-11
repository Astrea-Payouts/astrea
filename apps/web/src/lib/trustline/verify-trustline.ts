import { Horizon } from "@stellar/stellar-sdk";
import { env } from "@/lib/env";
import { HORIZON_URL } from "@/lib/stellar-network";

// ADR-004: checked at registration AND re-checked at winner assignment — a
// missing trustline discovered at payout time is the worst possible UX.
//
// "Has the trustline" means it can actually receive a payment: the issuer has
// authorized it and its limit leaves room for at least one stroop. The payout
// amount isn't known here; core-go's /release/build checks each winner
// against the exact stroops it is paid.
export async function hasUsdcTrustline(publicKey: string): Promise<boolean> {
	const server = new Horizon.Server(HORIZON_URL);
	try {
		const account = await server.loadAccount(publicKey);
		const line = account.balances.find(
			(balance) =>
				"asset_code" in balance &&
				"asset_issuer" in balance &&
				balance.asset_code === env.USDC_SYMBOL &&
				balance.asset_issuer === env.USDC_ISSUER,
		);
		if (!line) return false;
		const { is_authorized, limit, balance, buying_liabilities } =
			line as typeof line & {
				is_authorized?: boolean;
				limit?: string;
				buying_liabilities?: string;
			};
		// A missing is_authorized reads as false (fail closed).
		if (is_authorized !== true) return false;
		return trustlineHeadroom(limit, balance, buying_liabilities) > ZERO;
	} catch (err) {
		// A brand new account with no XLM doesn't exist on the ledger yet —
		// that's "no trustline", not an error to propagate.
		if (isNotFoundError(err)) return false;
		throw err;
	}
}

// limit - balance - buying_liabilities in stroops: what the trustline can
// still receive before a payment fails with op_line_full.
function trustlineHeadroom(
	limit: string | undefined,
	balance: string | undefined,
	buyingLiabilities: string | undefined,
): bigint {
	return toStroops(limit) - toStroops(balance) - toStroops(buyingLiabilities);
}

// BigInt() instead of literals: tsconfig targets ES2017.
const ZERO = BigInt(0);
const STROOPS_PER_UNIT = BigInt(10_000_000);

// Horizon amounts are decimal strings with up to 7 places; BigInt keeps the
// max limit (922337203685.4775807) exact, which a Number would not.
function toStroops(value: string | undefined): bigint {
	if (value === undefined || value === "") return ZERO;
	const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(value);
	if (!match) throw new Error(`horizon: malformed amount "${value}"`);
	return (
		BigInt(match[1]) * STROOPS_PER_UNIT +
		BigInt((match[2] ?? "").padEnd(7, "0"))
	);
}

function isNotFoundError(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"response" in err &&
		(err as { response?: { status?: number } }).response?.status === 404
	);
}
