"use server";

import { StrKey } from "@stellar/stellar-sdk";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { parseUsdcAmount } from "@/lib/escrow/amount";
import { STELLAR_ACCOUNT_ID } from "@/lib/stellar-network";
import { getSessionWallet } from "@/lib/wallet/session";

// Server actions are reachable by direct POST, so the session and every
// field are re-checked here regardless of what the form enforced.

export type CreateDraftResult =
	| { ok: true; id: string }
	| {
			ok: false;
			// Keys under "OrganizerNew.errors"; `detail` is verbatim text
			// (a 1-based prize row, a Prisma message).
			code:
				| "notConnected"
				| "invalidName"
				| "noPrizes"
				| "invalidPrize"
				| "invalidJudgeAddress"
				| "judgeIsOrganizer"
				| "invalidJudgeName"
				| "invalidDeadline"
				| "deadlinePast"
				| "writeFailed";
			detail?: string;
	  };

export interface CreateDraftEventInput {
	name: string;
	description: string;
	/** Decimal USDC amounts; rank is the 1-based position. */
	prizes: string[];
	judgeAddress: string;
	judgeName: string;
	/** ISO-8601 instant (the form converts its datetime-local value to UTC). */
	judgingDeadlineAt: string;
	/** IANA zone the organizer picked the deadline in; see schema.prisma. */
	timezone: string;
}

const NAME_MAX = 120;
const DESCRIPTION_MAX = 2000;
const JUDGE_NAME_MAX = 80;

function isValidTimezone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat("en", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

// Writes Event (DRAFT) + Prize[] + Judge (ACTIVE) in one nested create, so
// a rejected prize row leaves no half-built event behind. Nothing here
// touches the chain: funding and create_event are the next screen.
export async function createDraftEvent(
	input: CreateDraftEventInput,
): Promise<CreateDraftResult> {
	const session = await getSessionWallet();
	if (!session) return { ok: false, code: "notConnected" };

	const name = input.name.trim();
	if (name.length === 0 || name.length > NAME_MAX) {
		return { ok: false, code: "invalidName" };
	}
	const description = input.description.trim().slice(0, DESCRIPTION_MAX);

	if (input.prizes.length === 0) return { ok: false, code: "noPrizes" };
	const prizes: Array<{ rank: number; amount: string }> = [];
	for (const [i, raw] of input.prizes.entries()) {
		const amount = raw.trim();
		if (parseUsdcAmount(amount) === null) {
			return { ok: false, code: "invalidPrize", detail: `#${i + 1}` };
		}
		prizes.push({ rank: i + 1, amount });
	}

	const judgeAddress = input.judgeAddress.trim();
	if (
		!STELLAR_ACCOUNT_ID.test(judgeAddress) ||
		!StrKey.isValidEd25519PublicKey(judgeAddress)
	) {
		return { ok: false, code: "invalidJudgeAddress" };
	}
	if (judgeAddress === session.address) {
		return { ok: false, code: "judgeIsOrganizer" };
	}
	const judgeName = input.judgeName.trim();
	if (judgeName.length === 0 || judgeName.length > JUDGE_NAME_MAX) {
		return { ok: false, code: "invalidJudgeName" };
	}

	const deadlineMs = Date.parse(input.judgingDeadlineAt);
	if (Number.isNaN(deadlineMs)) return { ok: false, code: "invalidDeadline" };
	if (deadlineMs <= Date.now()) return { ok: false, code: "deadlinePast" };
	const timezone = isValidTimezone(input.timezone) ? input.timezone : "UTC";

	try {
		const event = await db.event.create({
			data: {
				organizerId: session.userId,
				organizerWalletId: session.id,
				name,
				description: description || null,
				status: "DRAFT",
				network: "TESTNET",
				judgingDeadlineAt: new Date(deadlineMs),
				timezone,
				prizes: { create: prizes },
				judges: {
					create: [{ walletAddress: judgeAddress, displayName: judgeName }],
				},
			},
			select: { id: true },
		});
		return { ok: true, id: event.id };
	} catch (err) {
		return {
			ok: false,
			code: "writeFailed",
			detail: err instanceof Error ? err.message : String(err),
		};
	}
}

// FormData adapter for useActionState; the typed function above is what
// the tests exercise. The redirect lives here, outside any try block.
export async function createDraftEventAction(
	_prev: CreateDraftResult | null,
	formData: FormData,
): Promise<CreateDraftResult> {
	const result = await createDraftEvent({
		name: String(formData.get("name") ?? ""),
		description: String(formData.get("description") ?? ""),
		prizes: formData.getAll("prize").map(String),
		judgeAddress: String(formData.get("judgeAddress") ?? ""),
		judgeName: String(formData.get("judgeName") ?? ""),
		judgingDeadlineAt: String(formData.get("judgingDeadlineAt") ?? ""),
		timezone: String(formData.get("timezone") ?? ""),
	});
	if (result.ok) {
		redirect({
			href: `/organizer/events/${result.id}/fund`,
			locale: await getLocale(),
		});
	}
	return result;
}
