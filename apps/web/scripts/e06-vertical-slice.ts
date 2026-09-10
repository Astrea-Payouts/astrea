// E06: the vertical slice demo. Proves E01-E05 work end to end against the
// real database and state machine.
//
// This script originally drove live testnet calls through Trustless Work
// (deploy escrow -> fund -> approve milestone -> release milestone -> judge
// forwards to winner). That backend was rejected in favor of a custom
// Soroban contract (docs/architecture.md ADR-001), and the TW adapter has
// been deleted — see PR #170. The real event-escrow contract has no
// approval step and no forwarding hop: `release_reward` pays every winner
// directly, in one call, signed only by the judge
// (smart-contracts/astrea/contracts/event-escrow/src/lib.rs). apps/web does
// not call the contract directly today — that's services/core-go's job per
// docs/architecture.md — so this script proves the DB + state-machine layer
// only, using a placeholder tx hash where a real `release_reward` call
// would go.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { prepareOperation, submitOperation } from "@/lib/escrow/pipeline";
import { transitionEvent, transitionPrize } from "@/lib/state-machines/apply";
import { verifyAndRecordTrustline } from "@/lib/trustline/verify-and-record";
import { hasUsdcTrustline } from "@/lib/trustline/verify-trustline";

interface Keys {
	publicKey: string;
	secret: string;
}
const accounts: Record<"organizer" | "judge" | "winner" | "resolver", Keys> =
	JSON.parse(
		readFileSync(
			new URL("../spikes/k01-trustless-work/.accounts.json", import.meta.url),
			"utf8",
		),
	);

function step(label: string) {
	console.log(`\n[step] ${label}`);
}

// Placeholder for the real `release_reward` transaction hash — see the file
// header for why apps/web doesn't submit one itself yet.
function placeholderTxHash(): string {
	return randomBytes(32).toString("hex");
}

async function findOrCreateWallet(address: string) {
	const existing = await db.wallet.findUnique({ where: { address } });
	if (existing) return existing;
	const user = await db.user.create({ data: {} });
	return db.wallet.create({ data: { address, userId: user.id } });
}

async function main() {
	const { organizer, judge, winner } = accounts;
	const prizeAmount = 1;
	const runId = Date.now();

	step("Set up organizer and winner wallets");
	const organizerWallet = await findOrCreateWallet(organizer.publicKey);
	const winnerWallet = await findOrCreateWallet(winner.publicKey);

	step(
		"Judge must already hold a trustline for the registration/assignment checks below (ADR-004)",
	);
	if (!(await hasUsdcTrustline(judge.publicKey))) {
		throw new Error(
			`Judge ${judge.publicKey} has no USDC trustline — run the K01 setup script first`,
		);
	}

	step("Create event (DRAFT)");
	const event = await db.event.create({
		data: {
			organizerId: organizerWallet.userId,
			organizerWalletId: organizerWallet.id,
			name: `Astrea E06 vertical slice ${runId}`,
			description:
				"Automated vertical-slice demo — proves E01-E05 work end to end",
		},
	});
	console.log("  event:", event.id);

	step("Add judge — the contract's sole release signer (ADR-003)");
	await db.judge.create({
		data: {
			eventId: event.id,
			walletAddress: judge.publicKey,
			displayName: "Demo Judge",
		},
	});

	step("Create prize (PENDING)");
	const prize = await db.prize.create({
		data: {
			eventId: event.id,
			rank: 1,
			amount: prizeAmount,
		},
	});
	console.log("  prize:", prize.id);

	step(
		"Event created, funded, and live — one reward locked on the organizer's AdminWallet (ADR-006)",
	);
	await transitionEvent(event.id, "DRAFT", "CREATED");
	await transitionEvent(event.id, "CREATED", "FUNDED");
	await transitionEvent(event.id, "FUNDED", "LIVE");

	step("Register winner + verify trustline (E05, registration checkpoint)");
	if (!(await verifyAndRecordTrustline(winnerWallet.id, winner.publicKey))) {
		throw new Error("winner has no USDC trustline");
	}
	await db.participant.create({
		data: {
			eventId: event.id,
			walletId: winnerWallet.id,
			submissionUrl: "https://github.com/astrea-example/demo",
		},
	});

	step("Judging begins");
	await transitionEvent(event.id, "LIVE", "JUDGING");

	step("Assign winner + re-verify trustline (E05, assignment checkpoint)");
	await db.prize.update({
		where: { id: prize.id },
		data: { winnerWalletId: winnerWallet.id },
	});
	await transitionPrize(prize.id, "PENDING", "ASSIGNED");
	if (!(await verifyAndRecordTrustline(winnerWallet.id, winner.publicKey))) {
		throw new Error("winner trustline no longer valid at assignment");
	}

	step(
		"Judge releases — release_reward pays the winner directly in one call, no approval/forward hop",
	);
	const releaseKey = `release-reward:${prize.id}`;
	const releasePrepared = await prepareOperation({
		idempotencyKey: releaseKey,
		operation: "release-reward",
		requestPayload: { prizeId: prize.id, winner: winner.publicKey },
		build: async () => ({ unsignedXdr: "placeholder-unsigned-xdr" }),
	});
	if (releasePrepared.alreadySucceeded)
		throw new Error("unexpected: fresh prize already released");
	const releaseSubmitted = await submitOperation({
		idempotencyKey: releaseKey,
		signedXdr: "placeholder-signed-xdr",
		submit: async () => ({ txHash: placeholderTxHash() }),
	});
	console.log("  released, tx:", releaseSubmitted.txHash);
	await transitionPrize(prize.id, "ASSIGNED", "RELEASED", {
		releaseTxHash: releaseSubmitted.txHash,
	});

	step("Mark event COMPLETED and record the audit Payout row");
	await transitionEvent(event.id, "JUDGING", "COMPLETED");
	await db.payout.create({
		data: {
			prizeId: prize.id,
			txHash: releaseSubmitted.txHash,
			amount: prizeAmount,
		},
	});

	step(
		"E02 — idempotency check: replaying the release submit must short-circuit, not resubmit",
	);
	const replay = await submitOperation({
		idempotencyKey: releaseKey,
		signedXdr: "irrelevant-because-already-succeeded",
		submit: () => {
			throw new Error(
				"submit must not be called again for an already-succeeded operation",
			);
		},
	});
	console.log(
		"  replay.alreadySucceeded:",
		replay.alreadySucceeded,
		"same txHash:",
		replay.txHash === releaseSubmitted.txHash,
	);
	if (!replay.alreadySucceeded || replay.txHash !== releaseSubmitted.txHash) {
		throw new Error(
			"idempotency guard failed to short-circuit the replayed release",
		);
	}

	console.log(
		"\n✅ E06 vertical slice complete — DB + state-machine layer verified end to end.",
	);
	console.log(`   Event ${event.id} / Prize ${prize.id}`);
	await db.$disconnect();
}

main().catch(async (err) => {
	console.error("\n[FATAL]", err);
	await db.$disconnect();
	process.exit(1);
});
