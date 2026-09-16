import type { PrizeStatus } from "@/generated/prisma/enums";
import { InvalidTransitionError } from "./errors";

// docs/product-flows.md "Prize states". RELEASED means release_reward's
// on-chain transfer to this prize's winner already landed — the contract
// has no approval step, so ASSIGNED goes straight to RELEASED (see
// docs/architecture.md ADR-001/ADR-003). DISPUTED skips RELEASED entirely —
// a resolved dispute pays the winner directly, with no forwarding step.
const PRIZE_TRANSITIONS: Record<PrizeStatus, PrizeStatus[]> = {
	PENDING: ["ASSIGNED"],
	ASSIGNED: ["RELEASED", "DISPUTED"],
	RELEASED: ["PAID_OUT"],
	PAID_OUT: [],
	DISPUTED: ["PAID_OUT"],
};

export function canTransitionPrize(
	from: PrizeStatus,
	to: PrizeStatus,
): boolean {
	return PRIZE_TRANSITIONS[from].includes(to);
}

export function assertPrizeTransition(
	from: PrizeStatus,
	to: PrizeStatus,
): void {
	if (!canTransitionPrize(from, to)) {
		throw new InvalidTransitionError("Prize", from, to);
	}
}
