// K01 spike runner: full multi-release escrow lifecycle against Trustless Work
// dev API on Stellar testnet, verifying the role model behind ADR-003.
//
// NOTE: endpoint paths and payload shapes here were reverse-engineered from the
// LIVE OpenAPI spec at https://dev.api.trustlesswork.com/docs-json — the public
// docs site (docs.trustlesswork.com) described a different (stale) v2 REST
// shape with array-based roles and batch milestone indexes. Trust this file
// and the OpenAPI spec over the prose docs.
//
//   1. deploy   — organizer signs; judge is BOTH approver and releaseSigner (ADR-003)
//   2. fund     — organizer locks the full prize pool (20 USDC)
//   3. NEG-1    — organizer impersonates disputeResolver on withdraw-remaining-funds (must fail)
//   4. NEG-2    — release milestone 0 BEFORE approval (must fail)
//   5. approve  — judge approves milestone 0
//   6. release  — judge releases milestone 0; winner balance must increase
//
// Every result (including expected failures) is recorded in .findings.json —
// that file is the deliverable of K01 and feeds back into ADR-001..004.
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
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

if (!TW_API_KEY) {
	console.error(
		"Missing TW_API_KEY in .env — request one at https://dapp.trustlesswork.com",
	);
	process.exit(1);
}

const accounts = JSON.parse(
	readFileSync(new URL("../.accounts.json", import.meta.url), "utf8"),
);
const server = new Horizon.Server(HORIZON_URL);
const findings = {
	startedAt: new Date().toISOString(),
	network: "testnet",
	steps: [],
};

function record(step, outcome, detail) {
	findings.steps.push({ step, outcome, detail });
	console.log(
		`[${outcome}] ${step}`,
		typeof detail === "string" ? detail : JSON.stringify(detail),
	);
}

async function tw(path, body) {
	const res = await fetch(`${TW_API_URL}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "x-api-key": TW_API_KEY },
		body: JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({ raw: "non-json response" }));
	if (!res.ok || data.status === "FAILED") {
		const err = new Error(`TW ${path} -> ${res.status}`);
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

// build unsigned XDR on TW, sign locally with the given role, submit via /helper/send-transaction
async function signAndSend(path, body, signerSecret) {
	const { unsignedTransaction } = await tw(path, body);
	return tw("/helper/send-transaction", {
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
	const { organizer, judge, winner, resolver } = accounts;
	// Scaled to fit a single Circle testnet faucet drop (20 USDC / request / 2h).
	const prizes = [12, 5, 3]; // 1st, 2nd, 3rd — total 20 USDC

	// ── 1. deploy ───────────────────────────────────────────────────────────
	const deployBody = {
		signer: organizer.publicKey,
		engagementId: `astrea-k01-${Date.now()}`,
		title: "Astrea K01 spike",
		description:
			"Three prizes, judge as sole approver AND release signer (ADR-003)",
		roles: {
			approver: judge.publicKey,
			serviceProvider: winner.publicKey,
			platformAddress: organizer.publicKey,
			releaseSigner: judge.publicKey, // ADR-003: judge, NOT organizer
			disputeResolver: resolver.publicKey,
		},
		platformFee: 0,
		milestones: prizes.map((amount, i) => ({
			description: `Prize #${i + 1}`,
			amount,
			receiver: winner.publicKey,
		})),
		trustline: { symbol: USDC_SYMBOL, address: USDC_ISSUER },
	};

	let contractId;
	try {
		const res = await signAndSend(
			"/deployer/multi-release",
			deployBody,
			organizer.secret,
		);
		contractId = res.contractId;
		record("deploy multi-release escrow", "PASS", `contractId=${contractId}`);
	} catch (err) {
		record("deploy multi-release escrow", "FAIL", err.data ?? err.message);
		throw err;
	}

	// ── 2. fund ─────────────────────────────────────────────────────────────
	const totalPrizes = prizes.reduce((a, b) => a + b, 0);
	try {
		const res = await signAndSend(
			"/escrow/multi-release/fund-escrow",
			{ contractId, signer: organizer.publicKey, amount: totalPrizes },
			organizer.secret,
		);
		record(`fund escrow (${totalPrizes} USDC)`, "PASS", res.message ?? res);
	} catch (err) {
		record(
			`fund escrow (${totalPrizes} USDC)`,
			"FAIL",
			err.data ?? err.message,
		);
		throw err;
	}

	// ── 3. NEG-1: organizer impersonates disputeResolver to withdraw funds ──
	try {
		await signAndSend(
			"/escrow/multi-release/withdraw-remaining-funds",
			{
				contractId,
				disputeResolver: organizer.publicKey, // organizer is NOT the real resolver
				distributions: [{ address: organizer.publicKey, amount: totalPrizes }],
			},
			organizer.secret,
		);
		record(
			"NEG-1 organizer impersonates disputeResolver",
			"UNEXPECTED-PASS",
			"organizer drained the escrow while NOT being the registered disputeResolver — ADR-003 assumption BROKEN, investigate before Phase 2",
		);
	} catch (err) {
		record(
			"NEG-1 organizer impersonates disputeResolver",
			"PASS(rejected)",
			err.data ?? err.message,
		);
	}

	// ── 4. NEG-2: release before approval ───────────────────────────────────
	try {
		await signAndSend(
			"/escrow/multi-release/release-milestone-funds",
			{ contractId, releaseSigner: judge.publicKey, milestoneIndex: "0" },
			judge.secret,
		);
		record(
			"NEG-2 release before approval",
			"UNEXPECTED-PASS",
			"released an unapproved milestone — approval gate not enforced, investigate",
		);
	} catch (err) {
		record(
			"NEG-2 release before approval",
			"PASS(rejected)",
			err.data ?? err.message,
		);
	}

	// ── 5. approve milestone 0 (judge) ──────────────────────────────────────
	try {
		const res = await signAndSend(
			"/escrow/multi-release/approve-milestone",
			{ contractId, milestoneIndex: "0", approver: judge.publicKey },
			judge.secret,
		);
		record("approve milestone 0 (judge)", "PASS", res.message ?? res);
	} catch (err) {
		record("approve milestone 0 (judge)", "FAIL", err.data ?? err.message);
		throw err;
	}

	// ── 6. release milestone 0 (judge) + balance check ──────────────────────
	const balanceBefore = await usdcBalance(winner.publicKey);
	try {
		const res = await signAndSend(
			"/escrow/multi-release/release-milestone-funds",
			{ contractId, releaseSigner: judge.publicKey, milestoneIndex: "0" },
			judge.secret,
		);
		const balanceAfter = await usdcBalance(winner.publicKey);
		const delta = balanceAfter - balanceBefore;
		const ok = Math.abs(delta - prizes[0]) < 0.001;
		record(
			"release milestone 0 (judge as releaseSigner)",
			ok ? "PASS" : "FAIL",
			`${res.message ?? ""} winner USDC ${balanceBefore} -> ${balanceAfter} (delta ${delta})`,
		);
	} catch (err) {
		record(
			"release milestone 0 (judge as releaseSigner)",
			"FAIL",
			err.data ?? err.message,
		);
		throw err;
	}

	findings.contractId = contractId;
	findings.finishedAt = new Date().toISOString();
	writeFileSync(
		new URL("../.findings.json", import.meta.url),
		JSON.stringify(findings, null, 2),
	);
	console.log(
		"\n[done] findings written to .findings.json — fold them into docs/architecture.md (ADR-001..004)",
	);
}

main().catch((err) => {
	findings.fatal = err.data ?? err.message;
	writeFileSync(
		new URL("../.findings.json", import.meta.url),
		JSON.stringify(findings, null, 2),
	);
	console.error("\n[spike aborted] partial findings written to .findings.json");
	process.exit(1);
});
