"use server";

import { revalidatePath } from "next/cache";
import { createBuild, createSubmit, walletBalance } from "@/lib/core-go/client";
import { getSessionWallet } from "@/lib/wallet/session";
import {
	type ActionFailure,
	failure,
	hashOf,
	NOT_CONNECTED,
	ownAddress,
} from "../action-result";

// The deposit step's actions and readEventStatus live one level up
// (../actions), shared with /start. Only the balance read and create_event
// are specific to this screen.

export type BalanceResult = { ok: true; balance: string } | ActionFailure;

export type CreateBuildResult =
	| {
			ok: true;
			unsignedTransactionXdr: string;
			// Go's sum of the Prize rows in stroops, as a decimal string — the
			// authoritative number; the page's own sum is display only.
			reward: string;
			escrowEventId: string;
	  }
	| ActionFailure;

export type CreateSubmitResult =
	| {
			ok: true;
			txHash: string;
			status: "succeeded" | "pending";
			escrowEventId: string;
	  }
	| ActionFailure;

export async function readBalance(address: string): Promise<BalanceResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	const refused = ownAddress(session, address);
	if (refused) return refused;
	try {
		const res = await walletBalance(session.address, session.address);
		return { ok: true, balance: res.balance };
	} catch (err) {
		return failure(err);
	}
}

// Go authorizes: X-Astrea-Wallet must be the event's organizer wallet, the
// event DRAFT with ≥ 1 prize and exactly one ACTIVE judge.
export async function buildCreate(eventId: string): Promise<CreateBuildResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	try {
		const res = await createBuild(eventId, session.address);
		return {
			ok: true,
			unsignedTransactionXdr: res.unsignedTransactionXdr,
			reward: String(res.reward),
			escrowEventId: res.escrowEventId,
		};
	} catch (err) {
		return failure(err);
	}
}

export async function submitCreate(
	eventId: string,
	signedTransactionXdr: string,
): Promise<CreateSubmitResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	try {
		const res = await createSubmit(
			eventId,
			session.address,
			signedTransactionXdr,
		);
		// Go moved the event DRAFT → CREATED; the public page and this one
		// must not serve a stale copy.
		revalidatePath(`/[locale]/events/${eventId}`, "page");
		revalidatePath(`/[locale]/organizer/events/${eventId}/fund`, "page");
		return { ok: true, ...res };
	} catch (err) {
		const f = failure(err);
		// The transaction confirmed on-chain but Go's build row had been
		// replaced meanwhile: money moved, the row did not. Surface the hash
		// of what confirmed so support can reconcile.
		if (f.code === "create_build_replaced") {
			f.txHash = hashOf(signedTransactionXdr);
		}
		return f;
	}
}
