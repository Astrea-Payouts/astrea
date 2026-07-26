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

export async function transitionPrize(
	prizeId: string,
	from: PrizeStatus,
	to: PrizeStatus,
): Promise<void> {
	assertPrizeTransition(from, to);
	const { count } = await db.prize.updateMany({
		where: { id: prizeId, status: from },
		data: { status: to },
	});
	if (count === 0) {
		throw new Error(
			`Prize ${prizeId} was not in status ${from} — concurrent transition or stale read`,
		);
	}
}
