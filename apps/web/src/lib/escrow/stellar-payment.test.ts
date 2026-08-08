import {
	Account,
	Horizon,
	Keypair,
	TransactionBuilder,
} from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar-network";
import { buildForwardPaymentXdr } from "./stellar-payment";

const FROM = Keypair.random().publicKey();
const TO = Keypair.random().publicKey();

describe("buildForwardPaymentXdr", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds a plain Stellar payment for the exact net amount the judge received", async () => {
		vi.spyOn(Horizon.Server.prototype, "loadAccount").mockResolvedValue(
			new Account(FROM, "5") as unknown as Awaited<
				ReturnType<Horizon.Server["loadAccount"]>
			>,
		);

		const { unsignedXdr } = await buildForwardPaymentXdr({
			fromPublicKey: FROM,
			toPublicKey: TO,
			amount: 0.997,
		});

		const tx = TransactionBuilder.fromXDR(
			unsignedXdr,
			STELLAR_NETWORK_PASSPHRASE,
		);
		expect("operations" in tx).toBe(true);
		const operation = "operations" in tx ? tx.operations[0] : undefined;
		expect(operation?.type).toBe("payment");
		if (operation?.type === "payment") {
			expect(operation.destination).toBe(TO);
			expect(operation.amount).toBe("0.9970000");
			expect(operation.asset.code).toBe("USDC");
		}
	});
});
