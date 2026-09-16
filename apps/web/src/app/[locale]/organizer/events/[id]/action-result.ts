import "server-only";

import { TransactionBuilder } from "@stellar/stellar-sdk";
import {
	CoreGoConfigError,
	CoreGoError,
	CoreGoTransportError,
} from "@/lib/core-go/client";
import { STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar-network";

// Same contract as the judge actions: Go's envelope is returned verbatim,
// never thrown, so the organizer sees `not_organizer` or
// `start_build_replaced` exactly as Go said it. Shared by every organizer
// screen's server actions (/fund, /start) — a "use server" file cannot
// export these sync helpers itself.
export type ActionFailure = {
	ok: false;
	status: number;
	code: string;
	message: string;
	// Only on *_build_replaced: the hash of the envelope that did confirm,
	// so the organizer can quote it. Go's 409 does not carry it.
	txHash?: string;
};

export const NOT_CONNECTED: ActionFailure = {
	ok: false,
	status: 401,
	code: "not_connected",
	message: "",
};

export function failure(err: unknown): ActionFailure {
	if (err instanceof CoreGoError) {
		return {
			ok: false,
			status: err.status,
			code: err.code,
			message: err.message,
		};
	}
	if (err instanceof CoreGoTransportError) {
		return {
			ok: false,
			status: err.status,
			code: "transport",
			message: err.message,
		};
	}
	// CORE_GO_URL / CORE_GO_SERVICE_TOKEN missing: a deploy problem, not Go's
	// answer — named so it is not mistaken for a network failure.
	if (err instanceof CoreGoConfigError) {
		return { ok: false, status: 0, code: "config", message: err.message };
	}
	return {
		ok: false,
		status: 0,
		code: "unknown",
		message: err instanceof Error ? err.message : String(err),
	};
}

// The path address and X-Astrea-Wallet are both the session wallet. An
// `address` that is not the session's is refused here without a round trip
// — Go would answer 403 not_wallet_owner anyway.
export function ownAddress(
	session: { address: string },
	address: string,
): ActionFailure | null {
	return session.address === address
		? null
		: {
				ok: false,
				status: 403,
				code: "not_wallet_owner",
				message: "address is not the session wallet",
			};
}

export function hashOf(signedTransactionXdr: string): string | undefined {
	try {
		return TransactionBuilder.fromXDR(
			signedTransactionXdr,
			STELLAR_NETWORK_PASSPHRASE,
		)
			.hash()
			.toString("hex");
	} catch {
		return undefined;
	}
}
