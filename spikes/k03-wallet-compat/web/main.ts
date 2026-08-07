import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import {
	Contract,
	nativeToScVal,
	rpc,
	TransactionBuilder,
} from "@stellar/stellar-sdk";

const CONTRACT_ID = "CDIWLY6ARVUGEJPUMWK5CZBEN4ENVAMY5NV2EGDF2EPKRGSVQTUAOIH3";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

StellarWalletsKit.init({
	network: Networks.TESTNET,
	modules: [
		new FreighterModule(),
		new AlbedoModule(),
		new xBullModule(),
		new LobstrModule(),
	],
});

function requireEl<T extends Element>(selector: string): T {
	const el = document.querySelector<T>(selector);
	if (!el) throw new Error(`missing element: ${selector}`);
	return el;
}

const logEl = requireEl<HTMLDivElement>("#log");
function log(msg: string, cls?: "pass" | "fail") {
	const line = document.createElement("div");
	if (cls) line.className = cls;
	line.textContent = msg;
	logEl.appendChild(line);
	logEl.scrollTop = logEl.scrollHeight;
}

requireEl<HTMLButtonElement>("#reset").addEventListener("click", () => {
	logEl.innerHTML = "";
});

requireEl<HTMLButtonElement>("#run").addEventListener("click", async () => {
	try {
		await runCheck();
	} catch (err) {
		log(`FAIL — ${err instanceof Error ? err.message : String(err)}`, "fail");
	}
});

async function runCheck() {
	log("\n[1/4] Opening wallet selection modal...");
	const { address } = await StellarWalletsKit.authModal();
	log(`  connected: ${address}`);

	log("[2/4] Building + simulating the ping(caller) transaction...");
	const server = new rpc.Server(RPC_URL);
	const account = await server.getAccount(address);
	const contract = new Contract(CONTRACT_ID);
	const tx = new TransactionBuilder(account, {
		fee: "1000000",
		networkPassphrase: NETWORK_PASSPHRASE,
	})
		.addOperation(
			contract.call("ping", nativeToScVal(address, { type: "address" })),
		)
		.setTimeout(60)
		.build();
	const prepared = await server.prepareTransaction(tx);
	log("  simulation OK, footprint + resource fee attached");

	log("[3/4] Asking the wallet to sign...");
	const { signedTxXdr } = await StellarWalletsKit.signTransaction(
		prepared.toXDR(),
		{ address, networkPassphrase: NETWORK_PASSPHRASE },
	);
	log("  wallet returned a signed transaction");

	log("[4/4] Submitting + polling for confirmation...");
	const signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
	const sendResult = await server.sendTransaction(signedTx);
	if (sendResult.status === "ERROR") {
		throw new Error(
			`submission rejected: ${JSON.stringify(sendResult.errorResult)}`,
		);
	}

	for (let i = 0; i < 20; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		const res = await server.getTransaction(sendResult.hash);
		if (res.status === "SUCCESS") {
			log(
				`PASS — ${address.slice(0, 8)}... signed and confirmed. tx: ${sendResult.hash}`,
				"pass",
			);
			log(`  https://stellar.expert/explorer/testnet/tx/${sendResult.hash}`);
			return;
		}
		if (res.status === "FAILED") {
			throw new Error(`transaction failed on-chain: ${JSON.stringify(res)}`);
		}
	}
	throw new Error("timed out waiting for confirmation");
}
