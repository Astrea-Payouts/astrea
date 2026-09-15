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

export type BuildResult =
	| { ok: true; unsignedTransactionXdr: string; winners: ReleaseWinner[] }
	| ReleaseFailure;

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
