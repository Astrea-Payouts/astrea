// K01 setup: creates the four role accounts on Stellar testnet, funds them with
// friendbot, and opens USDC trustlines where needed. Writes .accounts.json for
// the spike script. Safe to re-run — it always generates fresh accounts.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import {
	Asset,
	BASE_FEE,
	Horizon,
	Keypair,
	Networks,
	Operation,
	TransactionBuilder,
} from "@stellar/stellar-sdk";

const HORIZON_URL =
	process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const USDC = new Asset(
	process.env.USDC_SYMBOL ?? "USDC",
	process.env.USDC_ISSUER ??
		"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
);

const server = new Horizon.Server(HORIZON_URL);

async function friendbot(publicKey) {
	const res = await fetch(
		`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
	);
	if (!res.ok)
		throw new Error(
			`friendbot failed for ${publicKey}: ${res.status} ${await res.text()}`,
		);
}

async function addUsdcTrustline(keypair) {
	const account = await server.loadAccount(keypair.publicKey());
	const tx = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(Operation.changeTrust({ asset: USDC }))
		.setTimeout(60)
		.build();
	tx.sign(keypair);
	await server.submitTransaction(tx);
}

async function main() {
	// organizer funds the escrow; judge approves AND releases (ADR-003);
	// winner receives the prize; resolver is the dispute fallback.
	const roles = ["organizer", "judge", "winner", "resolver"];
	const accounts = {};

	for (const role of roles) {
		const kp = Keypair.random();
		accounts[role] = { publicKey: kp.publicKey(), secret: kp.secret() };
		await friendbot(kp.publicKey());
		console.log(
			`[ok] ${role.padEnd(9)} ${kp.publicKey()} funded with testnet XLM`,
		);
	}

	// USDC trustlines: organizer (holds and sends the prize pool) and winner (receives).
	for (const role of ["organizer", "winner"]) {
		await addUsdcTrustline(Keypair.fromSecret(accounts[role].secret));
		console.log(`[ok] ${role.padEnd(9)} USDC trustline created`);
	}

	writeFileSync(
		new URL("../.accounts.json", import.meta.url),
		JSON.stringify(accounts, null, 2),
	);
	console.log("\n[done] wrote .accounts.json");
	console.log(
		"\nNEXT STEP (manual): send testnet USDC to the organizer account:",
	);
	console.log(`  ${accounts.organizer.publicKey}`);
	console.log(
		"  Use the Circle faucet (https://faucet.circle.com — Stellar testnet) or any",
	);
	console.log(
		"  testnet USDC source. The spike needs 20 USDC (faucet limit). Then run: npm run spike",
	);
}

main().catch((err) => {
	console.error("[setup failed]", err?.response?.data ?? err);
	process.exit(1);
});
