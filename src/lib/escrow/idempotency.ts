// Pure idempotency rules for the build-sign-submit pipeline (E02, Principle 4).
// Kept separate from pipeline.ts so the actual decision logic is unit-testable
// without a database. Only SUCCEEDED is terminal — PENDING and FAILED both
// allow a fresh build/submit attempt, since a stalled or failed attempt must
// be retryable.

export interface OpRecord {
	status: "PENDING" | "SUCCEEDED" | "FAILED";
	txHash?: string;
}

export type PrepareDecision =
	| { action: "build" }
	| { action: "already-succeeded"; txHash: string };

export function decidePrepare(existing: OpRecord | null): PrepareDecision {
	if (existing?.status === "SUCCEEDED" && existing.txHash) {
		return { action: "already-succeeded", txHash: existing.txHash };
	}
	return { action: "build" };
}

export type SubmitDecision =
	| { action: "submit" }
	| { action: "already-succeeded"; txHash: string };

export function decideSubmit(existing: OpRecord | null): SubmitDecision {
	if (!existing) {
		throw new Error(
			"No operation record found for this idempotency key — prepareOperation must run before submitOperation",
		);
	}
	if (existing.status === "SUCCEEDED" && existing.txHash) {
		return { action: "already-succeeded", txHash: existing.txHash };
	}
	return { action: "submit" };
}
