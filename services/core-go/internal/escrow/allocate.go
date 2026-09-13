// allocate.go turns per-position prizes and their winning teams into the
// flat []Winner release_reward expects (rewards.rs). Pure and DB-free: it
// takes plain values, does no I/O, and never touches the database directly
// -- Prisma/apps/web owns Prize and TeamMember; this only validates the
// caller's inputs, it never reads them from anywhere.
//
// Amounts throughout are int64 in the token's smallest unit, the same
// convention EncodeI128 (wallet.go) uses -- e.g. stroops for XLM.
// Converting from the schema's Prize.amount Decimal(18,7) into that unit is
// the caller's job, out of scope here.
package escrow

import "fmt"

// Position is one prize slot an organizer configured at event creation
// (Prize.rank/amount in apps/web/prisma/schema.prisma), already converted
// to the token's smallest unit.
type Position struct {
	Place  uint32
	Amount int64
}

// Member is one TeamMember row: a wallet address, its ordinal (deterministic
// ordering within the team, and the remainder rule's tiebreak target), and
// its declared share of the team's prize in basis points
// (TeamMember.shareBasisPoints; 1 bp = 0.01%, 10000 bp = 100%).
type Member struct {
	Address          string
	Ordinal          int
	ShareBasisPoints int
}

// WinningTeam pairs one Position (by Place) with the team that won it.
type WinningTeam struct {
	Place   uint32
	Members []Member
}

// AllocationError names the position, and where applicable the member and
// its share, that made an allocation impossible -- so a caller can tell a
// team its split is unpayable at this prize size instead of surfacing a
// bare contract panic (release_reward asserts winner.amount > 0 per
// winner -- rewards.rs).
type AllocationError struct {
	Place            uint32
	MemberAddress    string // empty when the error isn't about one member
	ShareBasisPoints int
	Reason           string
}

func (e *AllocationError) Error() string {
	if e.MemberAddress == "" {
		return fmt.Sprintf("escrow: position %d: %s", e.Place, e.Reason)
	}
	return fmt.Sprintf("escrow: position %d, member %s (share %d bp): %s", e.Place, e.MemberAddress, e.ShareBasisPoints, e.Reason)
}

const (
	totalShareBasisPoints = 10000
	// maxWinnersAllocation mirrors maxWinners (lifecycle.go) / rewards.rs's
	// MAX_WINNERS. Kept as its own named constant here (rather than reusing
	// maxWinners directly) so this file's cap is legible on its own even
	// though the two values must never drift apart -- both trace to the
	// same contract-side limit.
	maxWinnersAllocation = maxWinners
)

// AllocateWinners turns reward, the organizer's per-position prizes, and
// each position's winning team into the flat []Winner release_reward
// expects (one Winner per team member, sharing that position's Place).
//
// Rules, in order, all sourced from either the contract (rewards.rs) or
// the TeamMember.shareBasisPoints comment in schema.prisma -- the contract
// of record between the schema and this function:
//
//  1. sum(positions.Amount) == reward; every position amount > 0.
//  2. Exactly one team per position, every position has a team; each
//     team's shares sum to exactly 10000 bp, every share > 0, and
//     ordinals are unique within a team.
//  3. Each member's amount is floor(position.Amount * share / 10000).
//  4. The remainder (position.Amount - sum(floors)) is added to the
//     member with the lowest Ordinal in that team -- not the lowest
//     slice index. This is the rule schema.prisma documents; it is not
//     configurable.
//  5. Every resulting member amount must be > 0 -- a small prize with a
//     tiny share can floor to zero, which the contract would reject for
//     the *entire* release. Returns *AllocationError naming the position,
//     member and share.
//  6. len(result) <= 25 (the contract's MAX_WINNERS). Rejected with the
//     actual count and the ceiling -- this positions×team-size limit is
//     left to this layer by the schema.
//  7. Post-condition, asserted here rather than left to the caller:
//     sum(result.Amount) == reward. A failure here means this function
//     has a bug; callers must never "fix" it by adjusting an amount.
func AllocateWinners(reward int64, positions []Position, teams []WinningTeam) ([]Winner, error) {
	if len(positions) == 0 {
		return nil, fmt.Errorf("escrow: no positions provided")
	}

	// Rule 1.
	var positionSum int64
	for _, p := range positions {
		if p.Amount <= 0 {
			return nil, &AllocationError{Place: p.Place, Reason: fmt.Sprintf("position amount must be > 0, got %d", p.Amount)}
		}
		positionSum += p.Amount
	}
	if positionSum != reward {
		return nil, fmt.Errorf("escrow: sum of position amounts (%d) does not equal reward (%d)", positionSum, reward)
	}

	// Rule 2 (team assignment half): exactly one team per position.
	if len(teams) != len(positions) {
		return nil, fmt.Errorf("escrow: got %d winning teams for %d positions, want exactly one team per position", len(teams), len(positions))
	}
	teamByPlace := make(map[uint32]WinningTeam, len(teams))
	for _, t := range teams {
		if _, exists := teamByPlace[t.Place]; exists {
			return nil, fmt.Errorf("escrow: more than one winning team declared for position %d", t.Place)
		}
		teamByPlace[t.Place] = t
	}

	// Rule 6, checked early: the total member count across every winning
	// team is exactly len(result), so it can be rejected before doing any
	// per-member floor/remainder work.
	totalMembers := 0
	for _, t := range teams {
		totalMembers += len(t.Members)
	}
	if totalMembers > maxWinnersAllocation {
		return nil, fmt.Errorf("escrow: allocation would produce %d winners, exceeding the contract's MAX_WINNERS cap of %d", totalMembers, maxWinnersAllocation)
	}

	winners := make([]Winner, 0, totalMembers)

	for _, pos := range positions {
		team, ok := teamByPlace[pos.Place]
		if !ok {
			return nil, fmt.Errorf("escrow: position %d has no winning team", pos.Place)
		}
		if len(team.Members) == 0 {
			return nil, &AllocationError{Place: pos.Place, Reason: "winning team has no members"}
		}

		// Rule 2 (share validation half).
		seenOrdinal := make(map[int]bool, len(team.Members))
		shareSum := 0
		for _, m := range team.Members {
			if m.ShareBasisPoints <= 0 {
				return nil, &AllocationError{Place: pos.Place, MemberAddress: m.Address, ShareBasisPoints: m.ShareBasisPoints, Reason: "share must be greater than zero basis points"}
			}
			if seenOrdinal[m.Ordinal] {
				return nil, &AllocationError{Place: pos.Place, MemberAddress: m.Address, Reason: fmt.Sprintf("duplicate ordinal %d within the team", m.Ordinal)}
			}
			seenOrdinal[m.Ordinal] = true
			shareSum += m.ShareBasisPoints
		}
		if shareSum != totalShareBasisPoints {
			return nil, &AllocationError{Place: pos.Place, Reason: fmt.Sprintf("team shares sum to %d bp, want exactly %d", shareSum, totalShareBasisPoints)}
		}

		// Rule 3: floor each member's share of this position's amount.
		amounts := make([]int64, len(team.Members))
		var floorSum int64
		for i, m := range team.Members {
			amt := (pos.Amount * int64(m.ShareBasisPoints)) / totalShareBasisPoints
			amounts[i] = amt
			floorSum += amt
		}

		// Rule 4: give the leftover remainder to the lowest-Ordinal member
		// -- found by Ordinal value, deliberately not by slice index, so a
		// caller passing members out of ordinal order still gets the right
		// one.
		if remainder := pos.Amount - floorSum; remainder != 0 {
			lowest := 0
			for i := 1; i < len(team.Members); i++ {
				if team.Members[i].Ordinal < team.Members[lowest].Ordinal {
					lowest = i
				}
			}
			amounts[lowest] += remainder
		}

		// Rule 5: floor-to-zero is unpayable, reject naming the culprit.
		for i, m := range team.Members {
			if amounts[i] <= 0 {
				return nil, &AllocationError{
					Place:            pos.Place,
					MemberAddress:    m.Address,
					ShareBasisPoints: m.ShareBasisPoints,
					Reason:           fmt.Sprintf("allocated amount %d is not payable at position amount %d", amounts[i], pos.Amount),
				}
			}
			winners = append(winners, Winner{Place: pos.Place, Amount: amounts[i], Address: m.Address})
		}
	}

	// Rule 7: post-condition. A failure here is this function's own bug,
	// never something a caller should paper over by nudging an amount.
	var total int64
	for _, w := range winners {
		total += w.Amount
	}
	if total != reward {
		panic(fmt.Sprintf("escrow: AllocateWinners invariant violated: sum of winner amounts (%d) != reward (%d)", total, reward))
	}

	return winners, nil
}
