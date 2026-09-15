"use server";

import { TransactionBuilder } from "@stellar/stellar-sdk";
import { revalidatePath } from "next/cache";
import {
	CoreGoError,
	CoreGoTransportError,
	createBuild,
	createSubmit,
	depositBuild,
	depositSubmit,
	walletBalance,
} from "@/lib/core-go/client";
import { db } from "@/lib/db";
import { STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar-network";
import { getSessionWallet } from "@/lib/wallet/session";

// Same contract as the judge actions: Go's envelope is returned verbatim,
// never thrown, so the organizer sees `not_organizer` or
// `create_build_replaced` exactly as Go said it.
export type FundFailure = {
	ok: false;
	status: number;
	code: string;
	message: string;
	// Only on create_build_replaced: the hash of the envelope that did
	// confirm, so the organizer can quote it. Go's 409 does not carry it.
	txHash?: string;
};

export type BalanceResult = { ok: true; balance: string } | FundFailure;

export type DepositBuildResult =
	| { ok: true; opId: string; unsignedTransactionXdr: string }
	| FundFailure;

export type DepositSubmitResult =
	| { ok: true; txHash: string; status: "succeeded" | "pending" }
	| FundFailure;

export type CreateBuildResult =
	| {
			ok: true;
			unsignedTransactionXdr: string;
			// Go's sum of the Prize rows in stroops, as a decimal string — the
			// authoritative number; the page's own sum is display only.
			reward: string;
			escrowEventId: string;
	  }
	| FundFailure;

export type CreateSubmitResult =
	| {
			ok: true;
			txHash: string;
			status: "succeeded" | "pending";
			escrowEventId: string;
	  }
	| FundFailure;

export type EventStatusResult =
	| { ok: true; status: string; escrowEventId: string | null }
	| FundFailure;

const NOT_CONNECTED: FundFailure = {
	ok: false,
	status: 401,
	code: "not_connected",
	message: "",
};

function failure(err: unknown): FundFailure {
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

// The path address and X-Astrea-Wallet are both the session wallet. An
// `address` that is not the session's is refused here without a round trip
// — Go would answer 403 not_wallet_owner anyway.
function ownAddress(session: { address: string }, address: string) {
	return session.address === address
		? null
		: ({
				ok: false,
				status: 403,
				code: "not_wallet_owner",
				message: "address is not the session wallet",
			} satisfies FundFailure);
}

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

function hashOf(signedTransactionXdr: string): string | undefined {
	try {
		return TransactionBuilder.fromXDR(
			signedTransactionXdr,
			STELLAR_NETWORK_PASSPHRASE,
		)
			.hash()
			.toString("hex");
	} catch {
		return undefined;
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

// "Check again" after a 202: re-reads the row Go updates when the pending
// create_event lands. No polling — the organizer clicks.
export async function readEventStatus(
	eventId: string,
): Promise<EventStatusResult> {
	const session = await getSessionWallet();
	if (!session) return NOT_CONNECTED;
	const event = await db.event.findUnique({
		where: { id: eventId },
		select: { status: true, escrowEventId: true, organizerWalletId: true },
	});
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
	if (event.status === "CREATED") {
		revalidatePath(`/[locale]/events/${eventId}`, "page");
	}
	return { ok: true, status: event.status, escrowEventId: event.escrowEventId };
}
