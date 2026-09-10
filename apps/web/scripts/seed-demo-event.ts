// L01: seed the standing demo event — a real event, funded with a real
// testnet escrow, left LIVE and awaiting judging on purpose. L02's demo
// video records the rest of the lifecycle (assign winner, judge releases)
// live against this event, instead of showing something that already
// happened. Reuses the K01 spike accounts, same pattern as E06.
//
// This originally provisioned the escrow via Trustless Work (deploy + fund
// calls). That backend was rejected in favor of a custom Soroban contract
// (docs/architecture.md ADR-001), and the TW adapter has been deleted — see
// PR #170. apps/web doesn't call the escrow contract directly (that's
// services/core-go's job per docs/architecture.md), so provisioning the
// actual on-chain event/wallet now happens separately, outside this script;
// this only seeds the DB-side event/judge/prize/participant rows.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { transitionEvent } from "@/lib/state-machines/apply";
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

async function findOrCreateWallet(address: string) {
	const existing = await db.wallet.findUnique({ where: { address } });
	if (existing) return existing;
	const user = await db.user.create({ data: {} });
	return db.wallet.create({ data: { address, userId: user.id } });
}

const PRIZE_AMOUNT = 1;

async function main() {
	const { organizer, judge, winner } = accounts;

	step("Set up organizer wallet");
	const organizerWallet = await findOrCreateWallet(organizer.publicKey);

	step(
		"Judge must already hold a trustline for the registration checks below (ADR-004)",
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
				"Standing demo event for the GrantFox application and L02's walkthrough video — testnet, live and awaiting judging.",
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
			amount: PRIZE_AMOUNT,
		},
	});
	console.log("  prize:", prize.id);

	step(
		"Event created, funded, and live — one reward locked on the organizer's AdminWallet (ADR-006)",
	);
	await transitionEvent(event.id, "DRAFT", "CREATED");
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
	console.log(`   Event ${event.id} / Prize ${prize.id}`);
	console.log(
		"   L02 records the rest live: assign winner -> judge releases (single on-chain call, no forwarding step).",
	);
	await db.$disconnect();
}

main().catch(async (err) => {
	console.error("\n[FATAL]", err);
	await db.$disconnect();
	process.exit(1);
});
