// Exploring: can the JUDGE also be the disputeResolver (merged role), so the
// dispute -> resolve redirect (06/07/08) works without needing a second,
// always-available person? If so: winner self-disputes once they know they
// won, judge (as the merged resolver) resolves straight to them — judge
// signs only ONCE (resolve), no separate resolver required for the happy
// path, and funds never pass through anyone's personal wallet at all.
//
// Known constraint from 06: "The dispute resolver cannot be the one to raise
// a dispute on a milestone" — so if judge==resolver, the JUDGE can't self
// dispute. Winner or organizer would have to raise it instead. This script
// tests the winner-raises / merged-judge-resolves path specifically.
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

async function usdcBalance(publicKey) {
	const account = await server.loadAccount(publicKey);
	const line = account.balances.find(
		(b) => b.asset_code === USDC_SYMBOL && b.asset_issuer === USDC_ISSUER,
	);
	return line ? Number(line.balance) : 0;
}

async function main() {
	const { organizer, judge, winner } = accounts;
	const prizeAmount = 1;

	// ── 1. deploy with JUDGE merged into approver + releaseSigner + disputeResolver ──
	const deployBody = {
		signer: organizer.publicKey,
		engagementId: `astrea-merged-judge-resolver-${Date.now()}`,
		title: "Astrea merged judge/resolver check",
		description:
			"Judge is approver, releaseSigner, AND disputeResolver at once",
		roles: {
			approver: judge.publicKey,
			serviceProvider: winner.publicKey,
			platformAddress: organizer.publicKey,
			releaseSigner: judge.publicKey,
			disputeResolver: judge.publicKey, // <-- merged, same address as approver/releaseSigner
		},
		platformFee: 0,
		milestones: [
			{
				description: "Prize (merged judge/resolver check)",
				amount: prizeAmount,
				receiver: organizer.publicKey,
			},
		],
		trustline: { symbol: USDC_SYMBOL, address: USDC_ISSUER },
	};

	let contractId;
	try {
		const res = await signAndSend(
			"/deployer/multi-release",
			"POST",
			deployBody,
			organizer.secret,
		);
		contractId = res.contractId;
		console.log("[ok] deployed with merged judge/resolver role:", contractId);
	} catch (err) {
		console.log(
			"[rejected] deploy with merged judge/resolver role:",
			JSON.stringify(err.data ?? err.message),
		);
		console.log(
			"\n[conclusion] Trustless Work does not allow the same address to hold both approver/releaseSigner and disputeResolver — merged-role idea is dead on arrival.",
		);
		return;
	}

	await signAndSend(
		"/escrow/multi-release/fund-escrow",
		"POST",
		{ contractId, signer: organizer.publicKey, amount: prizeAmount },
		organizer.secret,
	);
	console.log(`[ok] funded ${prizeAmount} USDC`);

	// ── 2. winner self-disputes (judge==resolver can't dispute their own escrow) ──
	try {
		await signAndSend(
			"/escrow/multi-release/dispute-milestone",
			"POST",
			{ contractId, milestoneIndex: "0", signer: winner.publicKey },
			winner.secret,
		);
		console.log("[ok] winner self-disputed the milestone");
	} catch (err) {
		console.log(
			"[rejected] winner dispute:",
			JSON.stringify(err.data ?? err.message),
		);
		throw err;
	}

	// ── 3. judge (== disputeResolver) resolves, sending funds straight to winner ──
	const winnerBefore = await usdcBalance(winner.publicKey);
	try {
		const res = await signAndSend(
			"/escrow/multi-release/resolve-milestone-dispute",
			"POST",
			{
				contractId,
				disputeResolver: judge.publicKey, // same address as approver/releaseSigner
				milestoneIndex: "0",
				distributions: [{ address: winner.publicKey, amount: prizeAmount }],
			},
			judge.secret,
		);
		console.log(
			"[ok] merged judge/resolver RESOLVED the dispute straight to winner:",
			res.message ?? res,
		);
	} catch (err) {
		console.log(
			"[rejected] merged judge/resolver resolve:",
			JSON.stringify(err.data ?? err.message),
		);
		throw err;
	}

	const winnerAfter = await usdcBalance(winner.publicKey);
	console.log(
		`[info] winner USDC ${winnerBefore} -> ${winnerAfter} (delta ${winnerAfter - winnerBefore})`,
	);
	console.log(
		"\n[conclusion]",
		winnerAfter - winnerBefore > 0
			? "MERGED judge/resolver WORKS: winner self-disputes, judge (as its own escrow's resolver) resolves straight to them in ONE signature, no second person needed."
			: "merged role deployed and disputed, but funds did not land on winner — investigate further.",
	);
}

main().catch((err) => {
	console.error("[fatal]", err.data ?? err.message);
	process.exit(1);
});
