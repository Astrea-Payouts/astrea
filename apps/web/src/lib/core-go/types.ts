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
	// Organizer path (#199).
	| "not_wallet_owner"
	| "invalid_amount"
	| "deposit_not_found"
	| "deposit_already_succeeded"
	| "no_pending_deposit"
	| "not_organizer"
	| "event_not_draft"
	| "event_already_on_chain"
	| "no_prizes"
	| "create_already_succeeded"
	| "no_pending_create"
	| "create_build_replaced"
	| (string & {});

export interface CoreGoErrorBody {
	error: { code: CoreGoErrorCode; message: string };
}

// Organizer path (#11 PR 1 / #199): balance, deposit, create. Amounts are
// strings of stroops (7 decimals) except `DepositBuildRequest.amount`, which
// Go takes as a decimal string and parses with escrow.AmountToStroops.

export interface WalletBalanceResponse {
	address: string;
	/** USDC balance in stroops, as a decimal string. */
	balance: string;
}

export interface DepositBuildRequest {
	/** Decimal USDC amount, e.g. "2.5"; > 0, at most 7 decimals. */
	amount: string;
}

export interface DepositBuildResponse {
	opId: string;
	unsignedTransactionXdr: string;
}

export interface DepositSubmitRequest {
	opId: string;
	signedTransactionXdr: string;
}

export interface DepositSubmitResponse {
	txHash: string;
	status: "succeeded" | "pending";
}

export interface CreateBuildResponse {
	unsignedTransactionXdr: string;
	/** Sum of the event's Prize rows in stroops, computed by Go — authoritative. */
	reward: number;
	escrowEventId: string;
}

export interface CreateSubmitRequest {
	signedTransactionXdr: string;
}

export interface CreateSubmitResponse {
	txHash: string;
	status: "succeeded" | "pending";
	escrowEventId: string;
}
