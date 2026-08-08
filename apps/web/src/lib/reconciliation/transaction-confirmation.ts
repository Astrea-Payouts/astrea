import { Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL } from "@/lib/stellar-network";

// Principle 2: the chain, not Trustless Work's own indexer, is the source of
// truth for "did this actually land." See docs/architecture.md's
// "Reconciliation loop" for why there's no TW event-log endpoint to use instead.
export async function isTransactionConfirmed(txHash: string): Promise<boolean> {
	const server = new Horizon.Server(HORIZON_URL);
	try {
		await server.transactions().transaction(txHash).call();
		return true;
	} catch (err) {
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
