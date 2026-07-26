import {
	Asset,
	BASE_FEE,
	Horizon,
	Operation,
	TransactionBuilder,
} from "@stellar/stellar-sdk";
import { env } from "@/lib/env";
import { HORIZON_URL, STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar-network";
import type { UnsignedTx } from "./types";

// ADR-007: the judge forwards a released prize to the winner via a plain
// Stellar payment — deliberately NOT a Trustless Work call, so it lives
// outside the EscrowProvider port.

export interface ForwardPaymentParams {
	fromPublicKey: string;
	toPublicKey: string;
	amount: number;
}

export async function buildForwardPaymentXdr(
	params: ForwardPaymentParams,
): Promise<UnsignedTx> {
	const server = new Horizon.Server(HORIZON_URL);
	const account = await server.loadAccount(params.fromPublicKey);
	const asset = new Asset(env.USDC_SYMBOL, env.USDC_ISSUER);

	const tx = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
	})
		.addOperation(
			Operation.payment({
				destination: params.toPublicKey,
				asset,
				amount: params.amount.toFixed(7),
			}),
		)
		.setTimeout(60)
		.build();

	return { unsignedXdr: tx.toXDR() };
}
