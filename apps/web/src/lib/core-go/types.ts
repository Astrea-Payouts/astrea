// Request/response shapes of services/core-go, copied from its README
// ("Release path" and "Status codes"). Neither request nor response ever
// carries a payout amount — amounts live in Postgres and in the signed
// transaction itself.

export interface ReleaseAssignment {
	rank: number;
	teamId: string;
}

export interface ReleaseBuildRequest {
	assignments: ReleaseAssignment[];
}

export interface ReleaseWinner {
	rank: number;
	teamId: string;
	teamMemberId: string;
	address: string;
}

export interface ReleaseBuildResponse {
	eventId: string;
	unsignedTransactionXdr: string;
	winners: ReleaseWinner[];
}

export interface ReleaseSubmitRequest {
	signedTransactionXdr: string;
}

// 200 → "succeeded"; 202 (RPC timeout, outcome unknown) → "pending".
export interface ReleaseSubmitResponse {
	txHash: string;
	status: "succeeded" | "pending";
}

// services/core-go/README.md "Status codes" — a union so screens can switch
// on it, but never exhaustive: unknown codes must still surface.
export type CoreGoErrorCode =
	| "unauthorized"
	| "invalid_wallet"
	| "invalid_request"
	| "event_not_found"
	| "not_judge"
	| "event_not_judging"
	| "event_not_on_chain"
	| "judge_ambiguous"
	| "assignments_invalid"
	| "allocation_failed"
	| "release_already_succeeded"
	| "no_pending_release"
	| "envelope_mismatch"
	| "simulation_failed"
	| "submission_failed"
	| "on_chain_failed"
	| "internal"
	| (string & {});

export interface CoreGoErrorBody {
	error: { code: CoreGoErrorCode; message: string };
}
