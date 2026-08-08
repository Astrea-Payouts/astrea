import type { EventStatus, PrizeStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { assertEventTransition } from "./event";
import { assertPrizeTransition } from "./prize";

// The where clause below (id + expected current status) makes the update
// atomic: if two callers race to transition the same row from the same
// state, only one `updateMany` matches and writes — the other gets count 0
// and must re-read before retrying, rather than silently overwriting a
// transition it never validated.

export async function transitionEvent(
	eventId: string,
	from: EventStatus,
	to: EventStatus,
): Promise<void> {
	assertEventTransition(from, to);
	const { count } = await db.event.updateMany({
		where: { id: eventId, status: from },
		data: { status: to },
	});
	if (count === 0) {
		throw new Error(
			`Event ${eventId} was not in status ${from} — concurrent transition or stale read`,
		);
	}
}

export interface TransitionPrizeExtra {
	releaseTxHash?: string;
	forwardTxHash?: string;
}

// releasedAt/paidOutAt are set here, at the moment of transition, rather
// than derived later from updatedAt — E04's reconciliation reads these
// directly to find a RELEASED prize with no matching forward within a
// short window (ADR-007).
export async function transitionPrize(
	prizeId: string,
	from: PrizeStatus,
	to: PrizeStatus,
	extra?: TransitionPrizeExtra,
): Promise<void> {
	assertPrizeTransition(from, to);
	const data: Record<string, unknown> = { status: to };
	if (to === "RELEASED") {
		data.releasedAt = new Date();
		if (extra?.releaseTxHash) data.releaseTxHash = extra.releaseTxHash;
	}
	if (to === "PAID_OUT") {
		data.paidOutAt = new Date();
		if (extra?.forwardTxHash) data.forwardTxHash = extra.forwardTxHash;
	}

	const { count } = await db.prize.updateMany({
		where: { id: prizeId, status: from },
		data,
	});
	if (count === 0) {
		throw new Error(
			`Prize ${prizeId} was not in status ${from} — concurrent transition or stale read`,
		);
	}
}
