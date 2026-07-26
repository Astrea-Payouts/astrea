// E01 decision check (Option A): "the judge receives and forwards." Winner is
// unknown at deploy time, so the milestone receiver is set to the JUDGE.
// After release, the judge holds the funds for a moment and immediately sends
// a normal Stellar payment to the real winner.
//
// This has been ASSUMED to work because release-milestone-funds is address-
// agnostic in the K01 spike (receiver=winner there) — but never verified with
// the judge as receiver specifically. Two things could break it that haven't
// been checked:
//   1. The judge account has no USDC trustline (01-setup-accounts.js only
//      opened one for organizer + winner) — release would fail without it.
//   2. Some undocumented role restriction on using approver/releaseSigner's
//      OWN address as the milestone receiver too.
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
	Asset,
	BASE_FEE,
	Horizon,
	Keypair,
	Networks,
	Operation,
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
const USDC = new Asset(USDC_SYMBOL, USDC_ISSUER);

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

async function ensureTrustline(keypair) {
	const account = await server.loadAccount(keypair.publicKey());
	const has = account.balances.some(
		(b) => b.asset_code === USDC_SYMBOL && b.asset_issuer === USDC_ISSUER,
	);
	if (has) {
		console.log(`[info] ${keypair.publicKey()} already has USDC trustline`);
		return;
	}
	const tx = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(Operation.changeTrust({ asset: USDC }))
		.setTimeout(60)
		.build();
	tx.sign(keypair);
	await server.submitTransaction(tx);
	console.log(`[ok] opened USDC trustline for ${keypair.publicKey()}`);
}

async function forwardPayment({ fromSecret, toPublicKey, amount }) {
	const fromKeypair = Keypair.fromSecret(fromSecret);
	const account = await server.loadAccount(fromKeypair.publicKey());
	const tx = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(
			Operation.payment({
				destination: toPublicKey,
				asset: USDC,
				amount: String(amount),
			}),
		)
		.setTimeout(60)
		.build();
	tx.sign(fromKeypair);
	return server.submitTransaction(tx);
}

async function main() {
	const { organizer, judge, winner, resolver } = accounts;
	const prizeAmount = 1; // small, testnet USDC is scarce

	// ── 0. make sure the judge can actually hold USDC ───────────────────────
	await ensureTrustline(Keypair.fromSecret(judge.secret));

	// ── 1. deploy: receiver = JUDGE (winner still unknown) ──────────────────
	const deployBody = {
		signer: organizer.publicKey,
		engagementId: `astrea-option-a-${Date.now()}`,
		title: "Astrea Option A check",
		description:
			"Judge as milestone receiver; forwards to winner after release",
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
				description: "Prize (Option A check)",
				amount: prizeAmount,
				receiver: judge.publicKey,
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

	// ── 2. fund ───────────────────────────────────────────────────────────
	await signAndSend(
		"/escrow/multi-release/fund-escrow",
		"POST",
		{ contractId, signer: organizer.publicKey, amount: prizeAmount },
		organizer.secret,
	);
	console.log(`[ok] funded ${prizeAmount} USDC`);

	// ── 3. approve (judge) ───────────────────────────────────────────────
	await signAndSend(
		"/escrow/multi-release/approve-milestone",
		"POST",
		{ contractId, milestoneIndex: "0", approver: judge.publicKey },
		judge.secret,
	);
	console.log("[ok] approved by judge");

	// ── 4. release to judge, verify balance ─────────────────────────────
	const judgeBefore = await usdcBalance(judge.publicKey);
	await signAndSend(
		"/escrow/multi-release/release-milestone-funds",
		"POST",
		{ contractId, releaseSigner: judge.publicKey, milestoneIndex: "0" },
		judge.secret,
	);
	const judgeAfter = await usdcBalance(judge.publicKey);
	const judgeReceived = judgeAfter - judgeBefore;
	console.log(
		`[info] judge USDC ${judgeBefore} -> ${judgeAfter} (delta ${judgeReceived})`,
	);
	// ADR-005: TW charges a fixed 0.3% protocol fee per milestone release —
	// the judge receives prizeAmount minus that fee, not the gross amount.
	const expectedAfterFee = prizeAmount * (1 - 0.003);
	if (Math.abs(judgeReceived - expectedAfterFee) > 0.001) {
		throw new Error(
			`release to judge landed ${judgeReceived}, expected ~${expectedAfterFee} (gross minus 0.3% ADR-005 fee)`,
		);
	}
	console.log("[ok] release-to-judge CONFIRMED (net of ADR-005's 0.3% fee)");

	// ── 5. judge forwards to winner via a normal Stellar payment ────────
	// forward exactly what the judge actually holds, not the gross prize amount
	const winnerBefore = await usdcBalance(winner.publicKey);
	await forwardPayment({
		fromSecret: judge.secret,
		toPublicKey: winner.publicKey,
		amount: judgeReceived,
	});
	const winnerAfter = await usdcBalance(winner.publicKey);
	console.log(
		`[info] winner USDC ${winnerBefore} -> ${winnerAfter} (delta ${winnerAfter - winnerBefore})`,
	);
	if (Math.abs(winnerAfter - winnerBefore - judgeReceived) > 0.001) {
		throw new Error(
			"forward payment to winner did not land the expected amount",
		);
	}
	console.log("[ok] judge-forwards-to-winner CONFIRMED");

	console.log(
		"\n[conclusion] Option A end-to-end (deploy->judge receiver->release->forward) WORKS as designed.",
	);
}

main().catch((err) => {
	console.error("[fatal]", err.data ?? err.message);
	process.exit(1);
});
