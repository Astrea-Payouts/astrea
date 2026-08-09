import { db } from "@/lib/db";
import {
	findStalledForwards,
	type StalledForwardAlert,
} from "./stalled-forwards";

// "Short window" per ADR-007 — a forward is one more signature after a
// release the judge just made; 5 minutes is generous slack for wallet UX,
// not network latency.
const STALLED_FORWARD_THRESHOLD_MS = 5 * 60 * 1000;

export async function findStalledForwardsInDb(
	now: Date = new Date(),
): Promise<StalledForwardAlert[]> {
	const released = await db.prize.findMany({
		where: { status: "RELEASED", releasedAt: { not: null } },
		select: { id: true, releasedAt: true, forwardTxHash: true },
	});

	const withReleasedAt = released.filter(
		(prize): prize is typeof prize & { releasedAt: Date } =>
			prize.releasedAt !== null,
	);

	return findStalledForwards(withReleasedAt, now, STALLED_FORWARD_THRESHOLD_MS);
}
