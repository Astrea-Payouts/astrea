"use server";

import { revalidatePath } from "next/cache";
import { startBuild, startQuote, startSubmit } from "@/lib/core-go/client";
import { getSessionWallet } from "@/lib/wallet/session";
import {
	type ActionFailure,
	failure,
	hashOf,
	NOT_CONNECTED,
} from "../action-result";

// The deposit step's actions and readEventStatus live one level up
// (../actions), shared with /fund. Only the go-live quote, build and submit
// are specific to this screen. Go is the only writer of LIVE: nothing here
// touches Event.status.

export type QuoteResult =
	| { ok: true; fee: string; balance: string; shortfall: string }
	| ActionFailure;

export type StartBuildResult =
	| {
			ok: true;
			unsignedTransactionXdr: string;
			// Unix seconds, what the contract will store.
			judgingDeadline: number;
			// Stroops as a decimal string — re-quoted at build time.
			fee: string;
	  }
	| ActionFailure;

export type StartSubmitResult =
	| { ok: true; txHash: string; status: "succeeded" | "pending" }
	| ActionFailure;

// Read-only: fee, free balance and shortfall in stroops. The screen's single
// source for whether the deposit step is needed.
export async function readQuote(eventId: string): Promise<QuoteResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	try {
		const res = await startQuote(eventId, session.address);
		return { ok: true, ...res };
	} catch (err) {
		return failure(err);
	}
}

// Go authorizes: X-Astrea-Wallet must be the event's organizer wallet, the
// event CREATED and on-chain, judgingDeadlineAt set and in the future, the
// free balance covering the fee.
export async function buildStart(eventId: string): Promise<StartBuildResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	try {
		const res = await startBuild(eventId, session.address);
		return {
			ok: true,
			unsignedTransactionXdr: res.unsignedTransactionXdr,
			judgingDeadline: res.judgingDeadline,
			fee: String(res.fee),
		};
	} catch (err) {
		return failure(err);
	}
}

export async function submitStart(
	eventId: string,
	signedTransactionXdr: string,
): Promise<StartSubmitResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	try {
		const res = await startSubmit(
			eventId,
			session.address,
			signedTransactionXdr,
		);
		// Go moved the event CREATED → LIVE (or will, on a 202); the public
		// page and this one must not serve a stale copy.
		revalidatePath(`/[locale]/events/${eventId}`, "page");
		revalidatePath(`/[locale]/organizer/events/${eventId}/start`, "page");
		return { ok: true, ...res };
	} catch (err) {
		const f = failure(err);
		// The transaction confirmed on-chain but Go's build row had been
		// replaced meanwhile: the fee moved, the row did not. Surface the hash
		// of what confirmed so support can reconcile.
		if (f.code === "start_build_replaced") {
			f.txHash = hashOf(signedTransactionXdr);
		}
		return f;
	}
}
