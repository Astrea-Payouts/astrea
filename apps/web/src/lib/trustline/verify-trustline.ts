import { Horizon } from "@stellar/stellar-sdk";
import { env } from "@/lib/env";
import { HORIZON_URL } from "@/lib/stellar-network";

// ADR-004: checked at registration AND re-checked at winner assignment — a
// missing trustline discovered at payout time is the worst possible UX.
export async function hasUsdcTrustline(publicKey: string): Promise<boolean> {
	const server = new Horizon.Server(HORIZON_URL);
	try {
		const account = await server.loadAccount(publicKey);
		return account.balances.some(
			(balance) =>
				"asset_code" in balance &&
				"asset_issuer" in balance &&
				balance.asset_code === env.USDC_SYMBOL &&
				balance.asset_issuer === env.USDC_ISSUER,
		);
	} catch (err) {
		// A brand new account with no XLM doesn't exist on the ledger yet —
		// that's "no trustline", not an error to propagate.
		if (isNotFoundError(err)) return false;
		throw err;
	}
}

function isNotFoundError(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"response" in err &&
		(err as { response?: { status?: number } }).response?.status === 404
	);
}
