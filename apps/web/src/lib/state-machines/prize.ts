import type { PrizeStatus } from "@/generated/prisma/enums";
import { InvalidTransitionError } from "./errors";

// docs/product-flows.md "Prize (milestone) states" + ADR-007. RELEASED means
// funds landed in the judge's wallet; PAID_OUT means the forward (or, from
// DISPUTED, the resolver's direct payout) is confirmed on-chain. DISPUTED
// skips RELEASED entirely — resolve-milestone-dispute pays the winner
// directly, with no forwarding step (see architecture.md ADR-007).
const PRIZE_TRANSITIONS: Record<PrizeStatus, PrizeStatus[]> = {
	PENDING: ["ASSIGNED"],
	ASSIGNED: ["APPROVED", "DISPUTED"],
	APPROVED: ["RELEASED", "DISPUTED"],
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
