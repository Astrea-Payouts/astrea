"use server";

import { revalidatePath } from "next/cache";
import { depositBuild, depositSubmit } from "@/lib/core-go/client";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/uuid";
import { getSessionWallet } from "@/lib/wallet/session";
import {
	type ActionFailure,
	failure,
	NOT_CONNECTED,
	ownAddress,
} from "./action-result";

// Actions every organizer screen for one event shares: the deposit step
// (/fund tops up for the reserve, /start for the go-live fee) and the
// "Check again" status read both poll after a 202.

export type DepositBuildResult =
	| { ok: true; opId: string; unsignedTransactionXdr: string }
	| ActionFailure;

export type DepositSubmitResult =
	| { ok: true; txHash: string; status: "succeeded" | "pending" }
	| ActionFailure;

export type EventStatusResult =
	| { ok: true; status: string; escrowEventId: string | null }
	| ActionFailure;

export async function buildDeposit(
	address: string,
	amount: string,
): Promise<DepositBuildResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	const refused = ownAddress(session, address);
	if (refused) return refused;
	try {
		const res = await depositBuild(session.address, session.address, amount);
		return { ok: true, ...res };
	} catch (err) {
		return failure(err);
	}
}

export async function submitDeposit(
	address: string,
	opId: string,
	signedTransactionXdr: string,
): Promise<DepositSubmitResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	const refused = ownAddress(session, address);
	if (refused) return refused;
	try {
		const res = await depositSubmit(
			session.address,
			session.address,
			opId,
			signedTransactionXdr,
		);
		return { ok: true, ...res };
	} catch (err) {
		return failure(err);
	}
}

// "Check again" after a 202: re-reads the row Go updates when the pending
// create_event / set_event_in_progress lands. No polling — the organizer
// clicks.
export async function readEventStatus(
	eventId: string,
): Promise<EventStatusResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	const event = isUuid(eventId)
		? await db.event.findUnique({
				where: { id: eventId },
				select: { status: true, escrowEventId: true, organizerWalletId: true },
			})
		: null;
	if (!event) {
		return {
			ok: false,
			status: 404,
			code: "event_not_found",
			message: "",
		};
	}
	if (event.organizerWalletId !== session.id) {
		return { ok: false, status: 403, code: "not_organizer", message: "" };
	}
	// The two states a submit-then-check screen waits for; the public page
	// must not serve the copy from before the transition.
	if (event.status === "CREATED" || event.status === "LIVE") {
		revalidatePath(`/[locale]/events/${eventId}`, "page");
	}
	return { ok: true, status: event.status, escrowEventId: event.escrowEventId };
}
