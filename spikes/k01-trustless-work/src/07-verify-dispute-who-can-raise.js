// Follow-up to 06: 06 only proved the ORGANIZER can call dispute-milestone
// (the loop short-circuited after the first success). That's the critical
// unanswered question: if dispute-milestone is organizer-only, the dispute
// -> resolve redirect reintroduces exactly what ADR-003 removed — a hostile
// or absent organizer could simply never dispute, stranding the winner.
// This script tests the JUDGE (approver) directly, on a fresh escrow, with
// no organizer attempt first.
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

async function main() {
	const { organizer, judge, winner, resolver } = accounts;
	const prizeAmount = 1;

	const deployBody = {
		signer: organizer.publicKey,
		engagementId: `astrea-dispute-who-${Date.now()}`,
		title: "Astrea dispute-raiser check",
		description: "Who besides the organizer can raise a milestone dispute?",
		roles: {
			approver: judge.publicKey,
			serviceProvider: winner.publicKey,
			platformAddress: organizer.publicKey,
			releaseSigner: judge.publicKey,
			disputeResolver: resolver.publicKey,
		},
		platformFee: 0,
		milestones: [
			{
				description: "Prize (dispute-raiser check)",
				amount: prizeAmount,
				receiver: organizer.publicKey,
			},
		],
		trustline: { symbol: USDC_SYMBOL, address: USDC_ISSUER },
	};

	const { contractId } = await signAndSend(
		"/deployer/multi-release",
		"POST",
		deployBody,
		organizer.secret,
	);
	console.log("[ok] deployed:", contractId);

	await signAndSend(
		"/escrow/multi-release/fund-escrow",
		"POST",
		{ contractId, signer: organizer.publicKey, amount: prizeAmount },
		organizer.secret,
	);
	console.log(`[ok] funded ${prizeAmount} USDC`);

	// The judge (approver), NOT the organizer, attempts to raise the dispute.
	try {
		const res = await signAndSend(
			"/escrow/multi-release/dispute-milestone",
			"POST",
			{ contractId, milestoneIndex: "0", signer: judge.publicKey },
			judge.secret,
		);
		console.log(
			"[ok] dispute-milestone signed by JUDGE(approver) SUCCEEDED:",
			res.message ?? res,
		);
		console.log(
			"\n[conclusion] the judge CAN raise a dispute without the organizer — the organizer is not a required party in this redirect path.",
		);
	} catch (err) {
		console.log(
			"[rejected] dispute-milestone signed by JUDGE(approver):",
			JSON.stringify(err.data ?? err.message),
		);
		console.log(
			"\n[conclusion] the judge CANNOT raise a dispute alone — this path requires the organizer, which reintroduces exactly what ADR-003 removed.",
		);
	}
}

main().catch((err) => {
	console.error("[fatal]", err.data ?? err.message);
	process.exit(1);
});
