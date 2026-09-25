"use server";

import { revalidatePath } from "next/cache";
import {
	CoreGoError,
	CoreGoTransportError,
	releaseBuild,
	releaseSubmit,
} from "@/lib/core-go/client";
import type {
	ReleaseAssignment,
	ReleaseSubmitResponse,
	ReleaseWinner,
} from "@/lib/core-go/types";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAndRecordTrustline } from "@/lib/trustline/verify-and-record";
import { isUuid } from "@/lib/uuid";
import { getSessionWallet } from "@/lib/wallet/session";

// Go's own error envelope, passed through verbatim so the judge sees
// `envelope_mismatch` / `not_judge` exactly as Go said it. Returned, not
// thrown: a thrown server-action error is replaced by a generic message in
// production, which would hide the code.
export type ReleaseFailure = {
	ok: false;
	status: number;
	code: string;
	message: string;
};

// ADR-004 re-check at assignment: `asset` is `code:issuer`, as in the
// registration refusal, and `wallets` lists every winning member without it.
// Key under the "JudgePage.errors" message namespace.
export type TrustlineFailure = {
	ok: false;
	code: "missingTrustline";
	asset: string;
	wallets: string[];
};

export type BuildResult =
	| { ok: true; unsignedTransactionXdr: string; winners: ReleaseWinner[] }
	| ReleaseFailure
	| TrustlineFailure;

export type SubmitResult =
	| ({ ok: true } & ReleaseSubmitResponse)
	| ReleaseFailure;

function failure(err: unknown): ReleaseFailure {
	if (err instanceof CoreGoError) {
		return {
			ok: false,
			status: err.status,
			code: err.code,
			message: err.message,
		};
	}
	if (err instanceof CoreGoTransportError) {
		return {
			ok: false,
			status: err.status,
			code: "transport",
			message: err.message,
		};
	}
	return {
		ok: false,
		status: 0,
		code: "unknown",
		message: err instanceof Error ? err.message : String(err),
	};
}

// Only for the caller the judge page shows the form to; anyone else falls
// through to Go, which answers not_judge / not JUDGING as before. This is
// not authorization (ADR-005): Go stays the one that refuses.
async function isActiveJudge(
	eventId: string,
	address: string,
): Promise<boolean> {
	if (!isUuid(eventId)) return false;
	const event = await db.event.findUnique({
		where: { id: eventId },
		select: {
			status: true,
			judges: { where: { status: "ACTIVE" }, select: { walletAddress: true } },
		},
	});
	return (
		event?.status === "JUDGING" &&
		event.judges.length === 1 &&
		event.judges[0].walletAddress === address
	);
}

// release_reward pays every winner in one atomic call, so a single closed
// trustline fails the whole payout. Returns the addresses that lack it.
async function winnersWithoutTrustline(
	eventId: string,
	assignments: ReleaseAssignment[],
): Promise<string[]> {
	const teamIds = [...new Set(assignments.map((a) => a.teamId))];
	const members = await db.teamMember.findMany({
		where: { eventId, teamId: { in: teamIds } },
		orderBy: [{ teamId: "asc" }, { ordinal: "asc" }],
		select: { wallet: { select: { id: true, address: true } } },
	});
	const checked = await Promise.all(
		members.map(async ({ wallet }) => ({
			address: wallet.address,
			ok: await verifyAndRecordTrustline(wallet.id, wallet.address),
		})),
	);
	return checked.filter((c) => !c.ok).map((c) => c.address);
}

// Go authorizes the caller: X-Astrea-Wallet must be the event's single
// ACTIVE judge, the event must be JUDGING. The web side only supplies the
// session wallet it verified via SEP-0043.
export async function buildRelease(
	eventId: string,
	assignments: ReleaseAssignment[],
): Promise<BuildResult> {
	const session = await getSessionWallet();
	if (!session) {
		return { ok: false, status: 401, code: "not_connected", message: "" };
	}
	try {
		if (await isActiveJudge(eventId, session.address)) {
			const missing = await winnersWithoutTrustline(eventId, assignments);
			if (missing.length > 0) {
				return {
					ok: false,
					code: "missingTrustline",
					asset: `${env.USDC_SYMBOL}:${env.USDC_ISSUER}`,
					wallets: missing,
				};
			}
		}
		const res = await releaseBuild(eventId, session.address, assignments);
		return {
			ok: true,
			unsignedTransactionXdr: res.unsignedTransactionXdr,
			winners: res.winners,
		};
	} catch (err) {
		return failure(err);
	}
}

export async function submitRelease(
	eventId: string,
	signedTransactionXdr: string,
): Promise<SubmitResult> {
	const session = await getSessionWallet();
	if (!session) {
		return { ok: false, status: 401, code: "not_connected", message: "" };
	}
	try {
		const res = await releaseSubmit(
			eventId,
			session.address,
			signedTransactionXdr,
		);
		// Go moved prizes → RELEASED and the event → COMPLETED; the public
		// page must not serve a stale copy.
		revalidatePath(`/[locale]/events/${eventId}`, "page");
		return { ok: true, ...res };
	} catch (err) {
		return failure(err);
	}
}
