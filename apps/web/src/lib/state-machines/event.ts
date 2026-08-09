import type { EventStatus } from "@/generated/prisma/enums";
import { InvalidTransitionError } from "./errors";

// docs/product-flows.md "Event state machine". Cancel is allowed from every
// state that already has an escrow at stake (CREATED onward) — a DRAFT event
// has no escrow yet, so it's discarded directly rather than "cancelled".
const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
	DRAFT: ["CREATED"],
	CREATED: ["FUNDED", "CANCELLED"],
	FUNDED: ["LIVE", "CANCELLED"],
	LIVE: ["JUDGING", "CANCELLED"],
	JUDGING: ["COMPLETED", "CANCELLED"],
	COMPLETED: [],
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
