// E01 follow-up: Option B ("pool escrow + per-prize escrow") only avoids
// routing funds through the organizer's personal wallet if the disputeResolver
// can withdraw remaining funds STRAIGHT to an arbitrary destination address
// (e.g. the winner) via `distributions`, rather than always returning them to
// whoever funded the escrow.
//
// K01's NEG-1 test already showed the request shape accepts a `distributions`
// array of {address, amount} — but that test used the ORGANIZER impersonating
// the resolver (and was correctly rejected for that reason), so it never
// proved what a REAL resolver signature is allowed to target.
//
// This script signs as the real resolver and points `distributions` at the
// WINNER (not the organizer), reusing the funded-but-untouched contract from
// 03-verify-update-escrow.js (CA25MAH..., 3 USDC, milestone 0 still pending).
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
	Horizon,
	Keypair,
	Networks,
	TransactionBuilder,
} from "@stellar/stellar-sdk";

const TW_API_URL =
	process.env.TW_API_URL ?? "https://dev.api.trustlesswork.com";
const TW_API_KEY = process.env.TW_API_KEY;
const HORIZON_URL =
	process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const USDC_SYMBOL = process.env.USDC_SYMBOL ?? "USDC";
const USDC_ISSUER =
	process.env.USDC_ISSUER ??
	"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const accounts = JSON.parse(
	readFileSync(new URL("../.accounts.json", import.meta.url), "utf8"),
);
const server = new Horizon.Server(HORIZON_URL);

// Reused from 03-verify-update-escrow.js: 3 USDC funded, milestone 0 untouched.
const CONTRACT_ID = "CA25MAHARTWSDFPDVSZO2D7LNOFPOYJAU2BPPHUYOMPAL7NP5XOPOPBS";

async function tw(path, method, body) {
	const res = await fetch(`${TW_API_URL}${path}`, {
		method,
		headers: { "Content-Type": "application/json", "x-api-key": TW_API_KEY },
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => ({ raw: "non-json" }));
	if (!res.ok || data.status === "FAILED") {
		const err = new Error(`TW ${method} ${path} -> ${res.status}`);
		err.data = data;
		throw err;
	}
	return data;
}

function signXdr(unsignedTransaction, secret) {
	const tx = TransactionBuilder.fromXDR(unsignedTransaction, Networks.TESTNET);
	tx.sign(Keypair.fromSecret(secret));
	return tx.toXDR();
}

async function signAndSend(path, method, body, signerSecret) {
	const { unsignedTransaction } = await tw(path, method, body);
	return tw("/helper/send-transaction", "POST", {
		signedXdr: signXdr(unsignedTransaction, signerSecret),
	});
}

async function readEscrow(contractId) {
	const url = `${TW_API_URL}/helper/get-escrow-by-contract-ids?contractIds[]=${encodeURIComponent(contractId)}&validateOnChain=true`;
	const res = await fetch(url, { headers: { "x-api-key": TW_API_KEY } });
	const data = await res.json();
	if (!res.ok) throw new Error(`read failed: ${JSON.stringify(data)}`);
	return Array.isArray(data) ? data[0] : data;
}

async function usdcBalance(publicKey) {
	const account = await server.loadAccount(publicKey);
	const line = account.balances.find(
		(b) => b.asset_code === USDC_SYMBOL && b.asset_issuer === USDC_ISSUER,
	);
	return line ? Number(line.balance) : 0;
}

async function main() {
	const { organizer, winner, resolver } = accounts;

	const before = await readEscrow(CONTRACT_ID);
	console.log("[info] escrow balance before:", before.balance);
	console.log("[info] roles.disputeResolver:", before.roles.disputeResolver);

	const winnerBefore = await usdcBalance(winner.publicKey);
	const organizerBefore = await usdcBalance(organizer.publicKey);
	console.log(
		`[info] winner USDC before: ${winnerBefore}, organizer USDC before: ${organizerBefore}`,
	);

	const amount = Number(before.balance);
	try {
		const res = await signAndSend(
			"/escrow/multi-release/withdraw-remaining-funds",
			"POST",
			{
				contractId: CONTRACT_ID,
				disputeResolver: resolver.publicKey,
				distributions: [{ address: winner.publicKey, amount }],
			},
			resolver.secret,
		);
		console.log(
			"[ok] real-resolver withdraw-to-winner SUCCEEDED:",
			res.message ?? res,
		);
	} catch (err) {
		console.log(
			"[rejected] real-resolver withdraw-to-winner:",
			JSON.stringify(err.data ?? err.message),
		);
		throw err;
	}

	const winnerAfter = await usdcBalance(winner.publicKey);
	const organizerAfter = await usdcBalance(organizer.publicKey);
	console.log(
		`[info] winner USDC after: ${winnerAfter} (delta ${winnerAfter - winnerBefore})`,
	);
	console.log(
		`[info] organizer USDC after: ${organizerAfter} (delta ${organizerAfter - organizerBefore})`,
	);
	console.log(
		"[conclusion]",
		winnerAfter - winnerBefore > 0
			? "withdraw-remaining-funds CAN target an arbitrary address (winner) directly — Option B does not require routing through the organizer's wallet."
			: "funds did NOT land on the requested distributions address — investigate destination behavior further.",
	);
}

main().catch((err) => {
	console.error("[fatal]", err.data ?? err.message);
	process.exit(1);
});
