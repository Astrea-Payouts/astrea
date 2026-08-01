// ADR-007: a released prize's funds sit in the judge's wallet until the
// forward payment lands. This must be caught fast, not discovered by a
// complaining winner — pure detection logic, unit-tested without a database.

export interface ReleasedPrize {
	id: string;
	releasedAt: Date;
	forwardTxHash: string | null;
}

export interface StalledForwardAlert {
	prizeId: string;
	releasedAt: Date;
	pendingForMs: number;
}

export function findStalledForwards(
	prizes: ReleasedPrize[],
	now: Date,
	thresholdMs: number,
): StalledForwardAlert[] {
	return prizes
		.filter((prize) => prize.forwardTxHash === null)
		.map((prize) => ({
			prizeId: prize.id,
			releasedAt: prize.releasedAt,
			pendingForMs: now.getTime() - prize.releasedAt.getTime(),
		}))
		.filter((alert) => alert.pendingForMs > thresholdMs);
}
