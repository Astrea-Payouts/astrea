// E06: the vertical slice demo. Proves E01-E05 work end to end, against the
// real database and real testnet — not another isolated spike of the TW API
// (that was K01's job). Reuses the K01 accounts so no fresh funding is
// needed: organizer funds, judge approves/releases/forwards (ADR-007),
// winner gets paid, and E04's reconciliation checks confirm it.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { netAmountAfterFee } from "@/lib/escrow/fees";
import { prepareOperation, submitOperation } from "@/lib/escrow/pipeline";
import {
	buildForwardPaymentXdr,
	submitForwardPayment,
} from "@/lib/escrow/stellar-payment";
import { trustlessWorkAdapter } from "@/lib/escrow/trustless-work-adapter";
import { findStalledForwardsInDb } from "@/lib/reconciliation/run";
import { isTransactionConfirmed } from "@/lib/reconciliation/transaction-confirmation";
import { transitionEvent, transitionPrize } from "@/lib/state-machines/apply";
import { STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar-network";
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

function signXdr(unsignedXdr: string, secret: string): string {
	const tx = TransactionBuilder.fromXDR(
		unsignedXdr,
		STELLAR_NETWORK_PASSPHRASE,
	);
	tx.sign(Keypair.fromSecret(secret));
	return tx.toXDR();
}

function step(label: string) {
	console.log(`\n[step] ${label}`);
}

async function findOrCreateWallet(address: string) {
	const existing = await db.wallet.findUnique({ where: { address } });
	if (existing) return existing;
	const user = await db.user.create({ data: {} });
	return db.wallet.create({ data: { address, userId: user.id } });
}

async function main() {
	const { organizer, judge, winner, resolver } = accounts;
	const prizeAmount = 1;
	const runId = Date.now();

	step("Set up organizer and winner wallets");
	const organizerWallet = await findOrCreateWallet(organizer.publicKey);
	const winnerWallet = await findOrCreateWallet(winner.publicKey);

	step(
		"Judge must already hold a USDC trustline to receive a release (ADR-007)",
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

	step("Add judge");
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
			amountUsdc: prizeAmount,
			milestoneIndex: 0,
		},
	});
	console.log("  prize:", prize.id);

	step(
		"Deploy escrow — judge is the milestone receiver, winner unknown yet (ADR-007)",
	);
	const deployKey = `deploy-escrow:${event.id}`;
	const deployPrepared = await prepareOperation({
		idempotencyKey: deployKey,
		operation: "deploy-escrow",
		requestPayload: { eventId: event.id },
		build: () =>
			trustlessWorkAdapter.deployEscrow({
				signerPublicKey: organizer.publicKey,
				engagementId: `astrea-e06-${runId}`,
				title: event.name,
				description: event.description ?? "",
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
						description: "1st place",
						amount: prizeAmount,
						receiver: judge.publicKey,
					},
				],
				trustline: { symbol: env.USDC_SYMBOL, address: env.USDC_ISSUER },
			}),
	});
	if (deployPrepared.alreadySucceeded)
		throw new Error("unexpected: fresh event already has a deploy op");
	const deploySubmitted = await submitOperation({
		idempotencyKey: deployKey,
		signedXdr: signXdr(deployPrepared.unsignedXdr, organizer.secret),
		submit: (signedXdr) =>
			trustlessWorkAdapter.submitSignedTransaction(signedXdr),
	});
	const contractId = deploySubmitted.contractId;
	if (!contractId)
		throw new Error("deploy submission did not return a contractId");
	console.log("  contractId:", contractId, "tx:", deploySubmitted.txHash);

	await db.event.update({
		where: { id: event.id },
		data: { escrowContractId: contractId },
	});
	await transitionEvent(event.id, "DRAFT", "CREATED");

	step("Fund escrow");
	const fundKey = `fund-escrow:${event.id}`;
	const fundPrepared = await prepareOperation({
		idempotencyKey: fundKey,
		operation: "fund-escrow",
		requestPayload: { contractId, amount: prizeAmount },
		build: () =>
			trustlessWorkAdapter.fundEscrow({
				contractId,
				signerPublicKey: organizer.publicKey,
				amount: prizeAmount,
			}),
	});
	if (fundPrepared.alreadySucceeded)
		throw new Error("unexpected: fresh event already funded");
	const fundSubmitted = await submitOperation({
		idempotencyKey: fundKey,
		signedXdr: signXdr(fundPrepared.unsignedXdr, organizer.secret),
		submit: (signedXdr) =>
			trustlessWorkAdapter.submitSignedTransaction(signedXdr),
	});
	console.log("  funded, tx:", fundSubmitted.txHash);

	await transitionEvent(event.id, "CREATED", "FUNDED");
	await transitionEvent(event.id, "FUNDED", "LIVE");

	step("Register winner + verify trustline (E05, registration checkpoint)");
	if (!(await verifyAndRecordTrustline(winnerWallet.id, winner.publicKey))) {
		throw new Error("winner has no USDC trustline");
	}
	await db.submission.create({
		data: {
			eventId: event.id,
			participantWalletId: winnerWallet.id,
			url: "https://github.com/astrea-example/demo",
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

	step("Judge approves the milestone");
	const approveKey = `approve-milestone:${prize.id}`;
	const approvePrepared = await prepareOperation({
		idempotencyKey: approveKey,
		operation: "approve-milestone",
		requestPayload: { contractId, milestoneIndex: prize.milestoneIndex },
		build: () =>
			trustlessWorkAdapter.approveMilestone({
				contractId,
				milestoneIndex: prize.milestoneIndex,
				approverPublicKey: judge.publicKey,
			}),
	});
	if (approvePrepared.alreadySucceeded)
		throw new Error("unexpected: fresh prize already approved");
	await submitOperation({
		idempotencyKey: approveKey,
		signedXdr: signXdr(approvePrepared.unsignedXdr, judge.secret),
		submit: (signedXdr) =>
			trustlessWorkAdapter.submitSignedTransaction(signedXdr),
	});
	await transitionPrize(prize.id, "ASSIGNED", "APPROVED");

	step(
		"Judge releases the milestone — funds land in the judge's own wallet (ADR-007)",
	);
	const releaseKey = `release-milestone:${prize.id}`;
	const releasePrepared = await prepareOperation({
		idempotencyKey: releaseKey,
		operation: "release-milestone",
		requestPayload: { contractId, milestoneIndex: prize.milestoneIndex },
		build: () =>
			trustlessWorkAdapter.releaseMilestone({
				contractId,
				milestoneIndex: prize.milestoneIndex,
				releaseSignerPublicKey: judge.publicKey,
			}),
	});
	if (releasePrepared.alreadySucceeded)
		throw new Error("unexpected: fresh prize already released");
	const releaseSubmitted = await submitOperation({
		idempotencyKey: releaseKey,
		signedXdr: signXdr(releasePrepared.unsignedXdr, judge.secret),
		submit: (signedXdr) =>
			trustlessWorkAdapter.submitSignedTransaction(signedXdr),
	});
	console.log("  released, tx:", releaseSubmitted.txHash);
	await transitionPrize(prize.id, "APPROVED", "RELEASED", {
		releaseTxHash: releaseSubmitted.txHash,
	});

	step(
		"Judge forwards the net amount to the winner (ADR-007, plain Stellar payment)",
	);
	const netAmount = netAmountAfterFee(prizeAmount);
	console.log(
		`  gross ${prizeAmount} USDC -> net ${netAmount} USDC (ADR-005 0.3% fee)`,
	);
	const forwardKey = `forward-payment:${prize.id}`;
	const forwardPrepared = await prepareOperation({
		idempotencyKey: forwardKey,
		operation: "forward-payment",
		requestPayload: { prizeId: prize.id, amount: netAmount },
		build: () =>
			buildForwardPaymentXdr({
				fromPublicKey: judge.publicKey,
				toPublicKey: winner.publicKey,
				amount: netAmount,
			}),
	});
	if (forwardPrepared.alreadySucceeded)
		throw new Error("unexpected: fresh prize already forwarded");
	const forwardSubmitted = await submitOperation({
		idempotencyKey: forwardKey,
		signedXdr: signXdr(forwardPrepared.unsignedXdr, judge.secret),
		submit: submitForwardPayment,
	});
	console.log("  forwarded, tx:", forwardSubmitted.txHash);
	await transitionPrize(prize.id, "RELEASED", "PAID_OUT", {
		forwardTxHash: forwardSubmitted.txHash,
	});

	step("Mark event COMPLETED and record the audit Payout row");
	await transitionEvent(event.id, "JUDGING", "COMPLETED");
	await db.payout.create({
		data: {
			prizeId: prize.id,
			txHash: forwardSubmitted.txHash,
			amountUsdc: netAmount,
		},
	});

	step(
		"E04 — confirm both hops directly against Horizon (Principle 2, not TW's own indexer)",
	);
	const releaseConfirmed = await isTransactionConfirmed(
		releaseSubmitted.txHash,
	);
	const forwardConfirmed = await isTransactionConfirmed(
		forwardSubmitted.txHash,
	);
	console.log("  release tx confirmed on-chain:", releaseConfirmed);
	console.log("  forward tx confirmed on-chain:", forwardConfirmed);
	if (!(releaseConfirmed && forwardConfirmed)) {
		throw new Error("a recorded tx hash did not confirm on Horizon");
	}

	step(
		"E04 — stalled-forward check (should be empty; this prize just paid out)",
	);
	const stalled = await findStalledForwardsInDb();
	const stillStalled = stalled.some((alert) => alert.prizeId === prize.id);
	console.log("  this prize flagged as stalled:", stillStalled);
	if (stillStalled)
		throw new Error(
			"prize incorrectly flagged as a stalled forward right after paying out",
		);

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
		"\n✅ E06 vertical slice complete — the product guarantee works end to end.",
	);
	console.log(
		`   Event ${event.id} / Prize ${prize.id} / contract ${contractId}`,
	);
	await db.$disconnect();
}

main().catch(async (err) => {
	console.error("\n[FATAL]", err);
	await db.$disconnect();
	process.exit(1);
});
