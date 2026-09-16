// Validates the invariant a plain SQL CHECK constraint cannot express: a
// team's member shares, taken together, must sum to exactly the full unit
// (10000 bp) and there must be at least one member. Postgres CHECK
// constraints can only see one row at a time, so the database enforces this
// with a deferred constraint trigger instead (see the
// 20260910080000_replace_participants_with_teams migration's
// check_team_shares function) — this is the same rule, available before an
// insert ever reaches the database.
//
// Each share's own bound (integer, > 0, <= 10000) IS a plain single-row
// CHECK constraint (team_members_shareBasisPoints_check) but is
// re-validated here too, deliberately: a set like [10000, 0] sums to
// exactly 10000 and would otherwise read as "valid" while still containing
// the zero-share member release_reward's `winner.amount > 0` assert
// rejects, failing the whole atomic release for every other winner in the
// same call (see rewards.rs:130). One caller-facing check, not two.
//
// No callers yet — building the expanded winners list and allocating the
// remainder is the Go release-wrapper's job (#25), out of scope here.

const FULL_UNIT_BASIS_POINTS = 10000;

export interface TeamShareValidationResult {
	valid: boolean;
	reason?: string;
}

export function validateTeamShares(
	shares: readonly number[],
): TeamShareValidationResult {
	if (shares.length === 0) {
		return { valid: false, reason: "a team must have at least one member" };
	}

	for (const share of shares) {
		if (
			!Number.isInteger(share) ||
			share <= 0 ||
			share > FULL_UNIT_BASIS_POINTS
		) {
			return {
				valid: false,
				reason: `each member's share must be an integer between 1 and ${FULL_UNIT_BASIS_POINTS} bp, got ${share}`,
			};
		}
	}

	const sum = shares.reduce((total, share) => total + share, 0);
	if (sum !== FULL_UNIT_BASIS_POINTS) {
		return {
			valid: false,
			reason: `member shares sum to ${sum} bp, must sum to exactly ${FULL_UNIT_BASIS_POINTS}`,
		};
	}

	return { valid: true };
}
