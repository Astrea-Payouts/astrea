// E01 pre-check: Astrea's product flow requires deploying + funding an
// escrow BEFORE winners are known (that's the whole point — "funds locked
// before the event starts"). But Trustless Work's milestone.receiver is set
// at deploy time. This script verifies whether `PUT /escrow/multi-release/
// update-escrow` can change a milestone's receiver after deploy/fund but
// before release, and critically: WHO is allowed to sign that update.
//
// Round 1 already established: the JUDGE is rejected outright —
// "Only the platform address should be able to execute this function".
// This round retries as the ORGANIZER with the exact stored shape (read via
// /helper/get-escrow-by-contract-ids first) — the update DTO is strict:
// per-milestone `flags` (not top-level), no extra read-only fields like
// contractBaseId/isActive/createdAt/balance/inconsistencies.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

const TW_API_URL =
	process.env.TW_API_URL ?? "https://dev.api.trustlesswork.com";
const TW_API_KEY = process.env.TW_API_KEY;
const USDC_SYMBOL = process.env.USDC_SYMBOL ?? "USDC";
const USDC_ISSUER =
	process.env.USDC_ISSUER ??
	"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const accounts = JSON.parse(
	readFileSync(new URL("../.accounts.json", import.meta.url), "utf8"),
);

// Reuse the contract from the previous run instead of spending more testnet
// USDC on a fresh deploy: CA25MAH... (organizer placeholder receiver, 3 USDC funded).
const CONTRACT_ID = "CA25MAHARTWSDFPDVSZO2D7LNOFPOYJAU2BPPHUYOMPAL7NP5XOPOPBS";

async function tw(path, method, body) {
	const res = await fetch(`${TW_API_URL}${path}`, {
		method,
		headers: { "Content-Type": "application/json", "x-api-key": TW_API_KEY },
		body: JSON.stringify(body),
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

async function main() {
	const { organizer, judge, winner, resolver } = accounts;

	const before = await readEscrow(CONTRACT_ID);
	console.log("[info] receiver before update:", before.milestones[0].receiver);

	// Build the update payload from the EXACT stored shape, changing only receiver.
	const updatedEscrow = {
		engagementId: before.engagementId,
		title: before.title,
		description: before.description,
		roles: before.roles,
		platformFee: before.platformFee,
		milestones: before.milestones.map((m) => ({
			description: m.description,
			amount: m.amount,
			status: m.status,
			evidence: m.evidence,
			flags: m.flags,
			receiver: winner.publicKey, // <-- the actual change
		})),
		trustline: before.trustline,
	};

	try {
		const res = await signAndSend(
			"/escrow/multi-release/update-escrow",
			"PUT",
			{
				signer: organizer.publicKey,
				contractId: CONTRACT_ID,
				escrow: updatedEscrow,
			},
			organizer.secret,
		);
		console.log(
			"[ok] organizer-signed update-escrow SUCCEEDED:",
			res.message ?? res,
		);
	} catch (err) {
		console.log(
			"[rejected] organizer-signed update-escrow:",
			JSON.stringify(err.data ?? err.message),
		);
		throw err;
	}

	const after = await readEscrow(CONTRACT_ID);
	console.log("[info] receiver after update:", after.milestones[0].receiver);
	console.log(
		"[info] changed correctly:",
		after.milestones[0].receiver === winner.publicKey,
	);
}

main().catch((err) => {
	console.error("[fatal]", err.data ?? err.message);
	process.exit(1);
});
