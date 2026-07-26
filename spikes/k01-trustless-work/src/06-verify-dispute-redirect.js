// Council follow-up: the live OpenAPI spec has TWO dispute endpoints per
// milestone (not the pool-level withdraw-remaining-funds tested in 04):
//   POST /escrow/multi-release/dispute-milestone         {contractId, milestoneIndex, signer}
//   POST /escrow/multi-release/resolve-milestone-dispute  {contractId, disputeResolver, milestoneIndex, distributions}
//
// resolve-milestone-dispute's `distributions` targets ARBITRARY addresses,
// same shape as withdraw-remaining-funds, but scoped to ONE milestone and
// without the "all milestones released/disputed" gate. If a milestone can be
// disputed and then resolved straight to the real winner, that would beat
// Option A (ADR-007): no judge custody window at all, funds go escrow ->
// winner directly, authorized by the disputeResolver instead of a forward
// hop. Two unknowns to test:
//   1. WHO is allowed to sign dispute-milestone (organizer? judge? resolver?)
//   2. Does resolve-milestone-dispute really deliver to an address that was
//      never the milestone's configured receiver (the winner, set up as a
//      placeholder-free bystander here)?
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

async function tryDispute(
	label,
	contractId,
	milestoneIndex,
	signerRole,
	secret,
) {
	try {
		const res = await signAndSend(
			"/escrow/multi-release/dispute-milestone",
			"POST",
			{ contractId, milestoneIndex, signer: signerRole },
			secret,
		);
		console.log(
			`[ok] dispute-milestone signed by ${label} SUCCEEDED:`,
			res.message ?? res,
		);
		return true;
	} catch (err) {
		console.log(
			`[rejected] dispute-milestone signed by ${label}:`,
			JSON.stringify(err.data ?? err.message),
		);
		return false;
	}
}

async function main() {
	const { organizer, judge, winner, resolver } = accounts;
	const prizeAmount = 1;

	// ── 1. deploy: receiver = ORGANIZER (a placeholder that is neither the
	// judge nor the winner — proves any redirect via dispute is a real
	// redirect, not just "the receiver happened to already be right") ─────
	const deployBody = {
		signer: organizer.publicKey,
		engagementId: `astrea-dispute-check-${Date.now()}`,
		title: "Astrea dispute-redirect check",
		description:
			"Milestone receiver is a placeholder; testing dispute->resolve straight to winner",
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
				description: "Prize (dispute-redirect check)",
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

	// ── 2. who can dispute? try resolver, then organizer, then judge/approver ──
	const milestoneIndex = "0";
	let disputed = await tryDispute(
		"disputeResolver",
		contractId,
		milestoneIndex,
		resolver.publicKey,
		resolver.secret,
	);
	if (!disputed)
		disputed = await tryDispute(
			"organizer(platformAddress)",
			contractId,
			milestoneIndex,
			organizer.publicKey,
			organizer.secret,
		);
	if (!disputed)
		disputed = await tryDispute(
			"judge(approver)",
			contractId,
			milestoneIndex,
			judge.publicKey,
			judge.secret,
		);
	if (!disputed)
		disputed = await tryDispute(
			"winner(serviceProvider)",
			contractId,
			milestoneIndex,
			winner.publicKey,
			winner.secret,
		);
	if (!disputed)
		throw new Error("no tested role could open a dispute on this milestone");

	// ── 3. resolve the dispute, redirecting funds straight to the winner ──
	const winnerBefore = await usdcBalance(winner.publicKey);
	const organizerBefore = await usdcBalance(organizer.publicKey);
	try {
		const res = await signAndSend(
			"/escrow/multi-release/resolve-milestone-dispute",
			"POST",
			{
				contractId,
				disputeResolver: resolver.publicKey,
				milestoneIndex,
				distributions: [{ address: winner.publicKey, amount: prizeAmount }],
			},
			resolver.secret,
		);
		console.log(
			"[ok] resolve-milestone-dispute SUCCEEDED:",
			res.message ?? res,
		);
	} catch (err) {
		console.log(
			"[rejected] resolve-milestone-dispute:",
			JSON.stringify(err.data ?? err.message),
		);
		throw err;
	}

	const winnerAfter = await usdcBalance(winner.publicKey);
	const organizerAfter = await usdcBalance(organizer.publicKey);
	console.log(
		`[info] winner USDC ${winnerBefore} -> ${winnerAfter} (delta ${winnerAfter - winnerBefore})`,
	);
	console.log(
		`[info] organizer(placeholder receiver) USDC ${organizerBefore} -> ${organizerAfter} (delta ${organizerAfter - organizerBefore})`,
	);
	console.log(
		"\n[conclusion]",
		winnerAfter - winnerBefore > 0
			? "dispute -> resolve CAN redirect a single milestone's funds directly to an address that was never the configured receiver. This beats Option A if it can be done WITHOUT it looking like a real dispute in the product UX."
			: "redirect did not land on the winner — dispute/resolve does not bypass the fixed receiver either.",
	);
}

main().catch((err) => {
	console.error("[fatal]", err.data ?? err.message);
	process.exit(1);
});
