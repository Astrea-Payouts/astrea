import type { EventStatus } from "@/generated/prisma/enums";
import { InvalidTransitionError } from "./errors";

// docs/product-flows.md "Event state machine". Cancel is allowed from every
// state that already has an escrow at stake (CREATED onward) — a DRAFT event
// has no escrow yet, so it's discarded directly rather than "cancelled".
// DISPUTED is reachable from CREATED, LIVE, or JUDGING per the 2026-09-09
// state machine decision; its own outgoing transitions aren't specified by
// that decision, so this assumes a resolved dispute lands on COMPLETED
// (paid out) or CANCELLED (refunded) — flag if that's wrong.
const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
	DRAFT: ["CREATED"],
	CREATED: ["FUNDED", "DISPUTED", "CANCELLED"],
	FUNDED: ["LIVE", "CANCELLED"],
	LIVE: ["JUDGING", "DISPUTED", "CANCELLED"],
	JUDGING: ["COMPLETED", "DISPUTED", "CANCELLED"],
	COMPLETED: [],
	DISPUTED: ["COMPLETED", "CANCELLED"],
	CANCELLED: [],
};

export function canTransitionEvent(
	from: EventStatus,
	to: EventStatus,
): boolean {
	return EVENT_TRANSITIONS[from].includes(to);
}

export function assertEventTransition(
	from: EventStatus,
	to: EventStatus,
): void {
	if (!canTransitionEvent(from, to)) {
		throw new InvalidTransitionError("Event", from, to);
	}
}
