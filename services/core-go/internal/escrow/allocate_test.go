package escrow

import (
	"errors"
	"reflect"
	"sort"
	"testing"
)

// winnersByAddress is a small test helper: sorts a []Winner copy by
// Address so assertions don't depend on iteration order.
func winnersByAddress(winners []Winner) []Winner {
	out := append([]Winner(nil), winners...)
	sort.Slice(out, func(i, j int) bool { return out[i].Address < out[j].Address })
	return out
}

func TestAllocateWinners_ExactSplitNoRemainder(t *testing.T) {
	positions := []Position{{Place: 1, Amount: 1000}}
	teams := []WinningTeam{{
		Place: 1,
		Members: []Member{
			{Address: "A", Ordinal: 0, ShareBasisPoints: 5000},
			{Address: "B", Ordinal: 1, ShareBasisPoints: 5000},
		},
	}}

	got, err := AllocateWinners(1000, positions, teams)
	if err != nil {
		t.Fatalf("AllocateWinners returned error: %v", err)
	}
	want := []Winner{
		{Place: 1, Amount: 500, Address: "A"},
		{Place: 1, Amount: 500, Address: "B"},
	}
	if !reflect.DeepEqual(winnersByAddress(got), winnersByAddress(want)) {
		t.Fatalf("winners = %+v, want %+v", got, want)
	}
}

// TestAllocateWinners_RemainderGoesToLowestOrdinal is the direct
// regression test for the schema's remainder rule, and it specifically
// proves the tiebreak target is Ordinal, not slice position: member "C"
// (ordinal 2) is passed *first* in the slice, with the lowest-ordinal
// member "A" passed last. If the implementation ever keyed off slice index
// instead of Ordinal, this test would hand the remainder to "C" instead of
// "A".
func TestAllocateWinners_RemainderGoesToLowestOrdinal(t *testing.T) {
	positions := []Position{{Place: 1, Amount: 100}}
	teams := []WinningTeam{{
		Place: 1,
		Members: []Member{
			{Address: "C", Ordinal: 2, ShareBasisPoints: 3334},
			{Address: "B", Ordinal: 1, ShareBasisPoints: 3333},
			{Address: "A", Ordinal: 0, ShareBasisPoints: 3333},
		},
	}}

	// floor(100*3334/10000)=33, floor(100*3333/10000)=33, floor(100*3333/10000)=33
	// sum of floors = 99, remainder = 1, must go to ordinal 0 ("A").
	got, err := AllocateWinners(100, positions, teams)
	if err != nil {
		t.Fatalf("AllocateWinners returned error: %v", err)
	}

	byAddr := map[string]int64{}
	for _, w := range got {
		byAddr[w.Address] = w.Amount
	}
	if byAddr["A"] != 34 {
		t.Fatalf("A (lowest ordinal) amount = %d, want 34 (33 + remainder 1)", byAddr["A"])
	}
	if byAddr["B"] != 33 {
		t.Fatalf("B amount = %d, want 33", byAddr["B"])
	}
	if byAddr["C"] != 33 {
		t.Fatalf("C amount = %d, want 33", byAddr["C"])
	}
}

func TestAllocateWinners_FloorToZeroRejected(t *testing.T) {
	// A 1-unit position split 9999/1 bp: the 1 bp member floors to 0.
	positions := []Position{{Place: 1, Amount: 1}}
	teams := []WinningTeam{{
		Place: 1,
		Members: []Member{
			{Address: "A", Ordinal: 0, ShareBasisPoints: 9999},
			{Address: "B", Ordinal: 1, ShareBasisPoints: 1},
		},
	}}

	_, err := AllocateWinners(1, positions, teams)
	if err == nil {
		t.Fatal("expected an error for a floor-to-zero allocation, got nil")
	}
	var allocErr *AllocationError
	if !errors.As(err, &allocErr) {
		t.Fatalf("error = %v (%T), want *AllocationError", err, err)
	}
	if allocErr.MemberAddress != "B" {
		t.Fatalf("AllocationError.MemberAddress = %q, want %q", allocErr.MemberAddress, "B")
	}
	if allocErr.Place != 1 {
		t.Fatalf("AllocationError.Place = %d, want 1", allocErr.Place)
	}
}

func TestAllocateWinners_25WinnersPasses(t *testing.T) {
	members := make([]Member, 25)
	// 25 members at 400 bp each = 10000 bp exactly.
	for i := range members {
		members[i] = Member{Address: string(rune('a' + i)), Ordinal: i, ShareBasisPoints: 400}
	}
	positions := []Position{{Place: 1, Amount: 2500}}
	teams := []WinningTeam{{Place: 1, Members: members}}

	got, err := AllocateWinners(2500, positions, teams)
	if err != nil {
		t.Fatalf("AllocateWinners returned error: %v", err)
	}
	if len(got) != 25 {
		t.Fatalf("len(winners) = %d, want 25", len(got))
	}
}

func TestAllocateWinners_26WinnersRejected(t *testing.T) {
	// Two positions of 13 members each = 26 total winners, one over the cap.
	memberSet := func(prefix string, n int, share int) []Member {
		members := make([]Member, n)
		for i := range members {
			members[i] = Member{Address: prefix + string(rune('a'+i)), Ordinal: i, ShareBasisPoints: share}
		}
		return members
	}
	positions := []Position{
		{Place: 1, Amount: 1300},
		{Place: 2, Amount: 1300},
	}
	teams := []WinningTeam{
		{Place: 1, Members: memberSet("p1-", 13, 10000/13)}, // shares won't sum exactly, but the cap check runs first
		{Place: 2, Members: memberSet("p2-", 13, 10000/13)},
	}

	_, err := AllocateWinners(2600, positions, teams)
	if err == nil {
		t.Fatal("expected an error for 26 total winners exceeding MAX_WINNERS(25), got nil")
	}
}

func TestAllocateWinners_SumMismatchRejected(t *testing.T) {
	positions := []Position{{Place: 1, Amount: 999}}
	teams := []WinningTeam{{
		Place:   1,
		Members: []Member{{Address: "A", Ordinal: 0, ShareBasisPoints: 10000}},
	}}

	// reward (1000) != sum(positions.Amount) (999).
	_, err := AllocateWinners(1000, positions, teams)
	if err == nil {
		t.Fatal("expected an error when positions don't sum to reward, got nil")
	}
}

func TestAllocateWinners_TeamOfOne(t *testing.T) {
	positions := []Position{{Place: 1, Amount: 777}}
	teams := []WinningTeam{{
		Place:   1,
		Members: []Member{{Address: "solo", Ordinal: 0, ShareBasisPoints: 10000}},
	}}

	got, err := AllocateWinners(777, positions, teams)
	if err != nil {
		t.Fatalf("AllocateWinners returned error: %v", err)
	}
	want := []Winner{{Place: 1, Amount: 777, Address: "solo"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("winners = %+v, want %+v", got, want)
	}
}

func TestAllocateWinners_MultiplePositionsMultipleTeams(t *testing.T) {
	positions := []Position{
		{Place: 1, Amount: 700},
		{Place: 2, Amount: 300},
	}
	teams := []WinningTeam{
		{Place: 1, Members: []Member{
			{Address: "W1", Ordinal: 0, ShareBasisPoints: 6000},
			{Address: "W2", Ordinal: 1, ShareBasisPoints: 4000},
		}},
		{Place: 2, Members: []Member{
			{Address: "W3", Ordinal: 0, ShareBasisPoints: 10000},
		}},
	}

	got, err := AllocateWinners(1000, positions, teams)
	if err != nil {
		t.Fatalf("AllocateWinners returned error: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("len(winners) = %d, want 3", len(got))
	}
	var total int64
	for _, w := range got {
		total += w.Amount
	}
	if total != 1000 {
		t.Fatalf("total = %d, want 1000", total)
	}
}

// --- validation edge cases --------------------------------------------------

func TestAllocateWinners_NoPositions(t *testing.T) {
	_, err := AllocateWinners(100, nil, nil)
	if err == nil {
		t.Fatal("expected an error for no positions, got nil")
	}
}

func TestAllocateWinners_ZeroAmountPosition(t *testing.T) {
	positions := []Position{{Place: 1, Amount: 0}}
	teams := []WinningTeam{{Place: 1, Members: []Member{{Address: "A", Ordinal: 0, ShareBasisPoints: 10000}}}}
	_, err := AllocateWinners(0, positions, teams)
	if err == nil {
		t.Fatal("expected an error for a zero-amount position, got nil")
	}
}

func TestAllocateWinners_MissingTeamForPosition(t *testing.T) {
	positions := []Position{
		{Place: 1, Amount: 500},
		{Place: 2, Amount: 500},
	}
	teams := []WinningTeam{
		{Place: 1, Members: []Member{{Address: "A", Ordinal: 0, ShareBasisPoints: 10000}}},
		// Place 2 team declared for the wrong place -- a duplicate for
		// place 1 instead, so position 2 ends up with no team.
		{Place: 1, Members: []Member{{Address: "B", Ordinal: 0, ShareBasisPoints: 10000}}},
	}
	_, err := AllocateWinners(1000, positions, teams)
	if err == nil {
		t.Fatal("expected an error for a duplicate/missing team assignment, got nil")
	}
}

func TestAllocateWinners_TeamShareSumNot10000(t *testing.T) {
	positions := []Position{{Place: 1, Amount: 500}}
	teams := []WinningTeam{{
		Place: 1,
		Members: []Member{
			{Address: "A", Ordinal: 0, ShareBasisPoints: 4000},
			{Address: "B", Ordinal: 1, ShareBasisPoints: 4000},
		},
	}}
	_, err := AllocateWinners(500, positions, teams)
	if err == nil {
		t.Fatal("expected an error when team shares don't sum to 10000 bp, got nil")
	}
}

func TestAllocateWinners_DuplicateOrdinal(t *testing.T) {
	positions := []Position{{Place: 1, Amount: 500}}
	teams := []WinningTeam{{
		Place: 1,
		Members: []Member{
			{Address: "A", Ordinal: 0, ShareBasisPoints: 5000},
			{Address: "B", Ordinal: 0, ShareBasisPoints: 5000},
		},
	}}
	_, err := AllocateWinners(500, positions, teams)
	if err == nil {
		t.Fatal("expected an error for duplicate ordinals within a team, got nil")
	}
}

func TestAllocateWinners_ZeroShareRejected(t *testing.T) {
	positions := []Position{{Place: 1, Amount: 500}}
	teams := []WinningTeam{{
		Place: 1,
		Members: []Member{
			{Address: "A", Ordinal: 0, ShareBasisPoints: 10000},
			{Address: "B", Ordinal: 1, ShareBasisPoints: 0},
		},
	}}
	_, err := AllocateWinners(500, positions, teams)
	if err == nil {
		t.Fatal("expected an error for a zero-bp share, got nil")
	}
}
