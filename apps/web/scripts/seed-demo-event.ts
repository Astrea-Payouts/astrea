// L01: seed the standing demo event — a real event, funded with a real
// testnet escrow, left LIVE and awaiting judging on purpose. L02's demo
// video records the rest of the lifecycle (assign winner, approve, release,
// forward) live against this event, instead of showing something that
// already happened. Reuses the K01 spike accounts, same pattern as E06.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { prepareOperation, submitOperation } from "@/lib/escrow/pipeline";
import { trustlessWorkAdapter } from "@/lib/escrow/trustless-work-adapter";
import { transitionEvent } from "@/lib/state-machines/apply";
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

const PRIZE_AMOUNT = 1;

async function main() {
	const { organizer, judge, winner } = accounts;
	const runId = Date.now();

	step("Set up organizer wallet");
	const organizerWallet = await findOrCreateWallet(organizer.publicKey);

	step(
		"Judge must already hold a USDC trustline to receive a release later (ADR-007)",
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
			name: "Astrea Demo Hackathon",
			description:
				"Standing demo event for the GrantFox application and L02's walkthrough video — funded on Stellar testnet, live and awaiting judging.",
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
			amountUsdc: PRIZE_AMOUNT,
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
				engagementId: `astrea-demo-${runId}`,
				title: event.name,
				description: event.description ?? "",
				roles: {
					approver: judge.publicKey,
					serviceProvider: winner.publicKey,
					platformAddress: organizer.publicKey,
					releaseSigner: judge.publicKey,
					disputeResolver: accounts.resolver.publicKey,
				},
				platformFee: 0,
				milestones: [
					{
						description: "1st place",
						amount: PRIZE_AMOUNT,
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
		requestPayload: { contractId, amount: PRIZE_AMOUNT },
		build: () =>
			trustlessWorkAdapter.fundEscrow({
				contractId,
				signerPublicKey: organizer.publicKey,
				amount: PRIZE_AMOUNT,
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

	step("Register a demo participant + verify trustline (E05)");
	const winnerWallet = await findOrCreateWallet(winner.publicKey);
	if (!(await verifyAndRecordTrustline(winnerWallet.id, winner.publicKey))) {
		throw new Error("demo participant has no USDC trustline");
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

	console.log(
		"\n✅ Demo event seeded — funded, live, awaiting judging on purpose.",
	);
	console.log(
		`   Event ${event.id} / Prize ${prize.id} / contract ${contractId}`,
	);
	console.log(
		"   L02 records the rest live: assign winner -> approve -> release -> forward.",
	);
	await db.$disconnect();
}

main().catch(async (err) => {
	console.error("\n[FATAL]", err);
	await db.$disconnect();
	process.exit(1);
});
