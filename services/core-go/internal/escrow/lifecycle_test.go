package escrow

import (
	"context"
	"testing"

	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

// Real testnet strkeys reused purely as well-formed addresses, same as
// wallet_test.go and pipeline_test.go -- none of these tests touch the
// network.
const (
	testWinner1Address = "GBXNBZFHSILK4HNBOVGANXADKY6FGJYH2R253PBPT4QF3CXEFJXBU27X"
	testWinner2Address = "GBLH7BFPOM5AUYM7E64SP25AR6HOUM3IDSZEFM6OEBHRVEM67JQZPEQA"
	testWinner3Address = "GCRN2BZIQPZ3AYMJUWB2FTQQD2BFQYCFS6UF7ELWIC2RRDTDXND4XI23"
)

// --- set_event_cancelled -------------------------------------------------

func TestSetEventCancelledHostFunction(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}

	hf, err := SetEventCancelledHostFunction(contract, testAccountAddress, eventID)
	if err != nil {
		t.Fatalf("SetEventCancelledHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "set_event_cancelled" {
		t.Fatalf("function name = %q, want %q", got, "set_event_cancelled")
	}
	args := hf.InvokeContract.Args
	if len(args) != 2 {
		t.Fatalf("got %d args, want 2 (admin, event_id)", len(args))
	}
	assertAccountAddress(t, args[0], testAccountAddress)
	gotID, err := EventIDFromScVal(args[1])
	if err != nil {
		t.Fatalf("decoding event_id arg: %v", err)
	}
	if gotID != eventID {
		t.Fatalf("event_id arg = %x, want %x", gotID, eventID)
	}
}

// --- expire_event ----------------------------------------------------------

// TestExpireEventHostFunction_NoSigner is the regression test for
// expire_event's defining trait: it takes no signer argument at all. A
// future edit that slips an admin/caller argument in front of event_id
// would change args[0]'s type from Bytes to Address and fail here.
func TestExpireEventHostFunction_NoSigner(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}

	hf := ExpireEventHostFunction(contract, eventID)

	if got := string(hf.InvokeContract.FunctionName); got != "expire_event" {
		t.Fatalf("function name = %q, want %q", got, "expire_event")
	}
	args := hf.InvokeContract.Args
	if len(args) != 1 {
		t.Fatalf("got %d args, want 1 (event_id only -- expire_event has no signer)", len(args))
	}
	gotID, err := EventIDFromScVal(args[0])
	if err != nil {
		t.Fatalf("decoding event_id arg: %v", err)
	}
	if gotID != eventID {
		t.Fatalf("event_id arg = %x, want %x", gotID, eventID)
	}
}

// --- release_reward: struct-map key order --------------------------------

// TestWinnerScVal_KeyOrder is the direct regression test for this task's
// core encoding gotcha: #[contracttype] structs encode as an ScMap keyed
// by ScSymbol in *sorted* key order, not Winner's declaration order
// {place, amount, address} in types.rs. This test asserts the exact
// sequence {address, amount, place}, not just that all three keys are
// present.
func TestWinnerScVal_KeyOrder(t *testing.T) {
	w := Winner{Place: 1, Amount: 500, Address: testWinner1Address}
	scVal, err := winnerScVal(w)
	if err != nil {
		t.Fatalf("winnerScVal returned error: %v", err)
	}

	m, ok := scVal.GetMap()
	if !ok || m == nil {
		t.Fatalf("winnerScVal did not return an ScvMap, got %+v", scVal)
	}
	entries := *m
	if len(entries) != 3 {
		t.Fatalf("got %d map entries, want 3", len(entries))
	}

	wantKeys := []string{"address", "amount", "place"}
	for i, wantKey := range wantKeys {
		if entries[i].Key.Type != xdr.ScValTypeScvSymbol || entries[i].Key.Sym == nil {
			t.Fatalf("entry %d key = %+v, want an ScvSymbol", i, entries[i].Key)
		}
		if got := string(*entries[i].Key.Sym); got != wantKey {
			t.Fatalf("entry %d key = %q, want %q (sorted key order: %v)", i, got, wantKey, wantKeys)
		}
	}

	assertAccountAddress(t, entries[0].Val, testWinner1Address)
	assertI128(t, entries[1].Val, 500)
	if entries[2].Val.Type != xdr.ScValTypeScvU32 || entries[2].Val.U32 == nil {
		t.Fatalf("place value = %+v, want an ScvU32", entries[2].Val)
	}
	if got := uint32(*entries[2].Val.U32); got != 1 {
		t.Fatalf("place value = %d, want 1", got)
	}
}

// TestParticipantScVal_KeyOrder is the Participants analogue of
// TestWinnerScVal_KeyOrder: {address, amount_compensation} happens to
// already be alphabetically sorted, but it is asserted explicitly here
// rather than left implicit, exactly like Winner.
func TestParticipantScVal_KeyOrder(t *testing.T) {
	p := Participant{Address: testWinner1Address, AmountCompensation: 250}
	scVal, err := participantScVal(p)
	if err != nil {
		t.Fatalf("participantScVal returned error: %v", err)
	}

	m, ok := scVal.GetMap()
	if !ok || m == nil {
		t.Fatalf("participantScVal did not return an ScvMap, got %+v", scVal)
	}
	entries := *m
	if len(entries) != 2 {
		t.Fatalf("got %d map entries, want 2", len(entries))
	}

	wantKeys := []string{"address", "amount_compensation"}
	for i, wantKey := range wantKeys {
		if entries[i].Key.Type != xdr.ScValTypeScvSymbol || entries[i].Key.Sym == nil {
			t.Fatalf("entry %d key = %+v, want an ScvSymbol", i, entries[i].Key)
		}
		if got := string(*entries[i].Key.Sym); got != wantKey {
			t.Fatalf("entry %d key = %q, want %q (sorted key order: %v)", i, got, wantKey, wantKeys)
		}
	}

	assertAccountAddress(t, entries[0].Val, testWinner1Address)
	assertI128(t, entries[1].Val, 250)
}

// --- release_reward: host function, N=1 and N>1 --------------------------

func TestReleaseRewardHostFunction_SingleWinner(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	winners := []Winner{{Place: 1, Amount: 30_000_000, Address: testWinner1Address}}

	hf, err := ReleaseRewardHostFunction(contract, testJudgeAddress, eventID, winners)
	if err != nil {
		t.Fatalf("ReleaseRewardHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "release_reward" {
		t.Fatalf("function name = %q, want %q", got, "release_reward")
	}
	args := hf.InvokeContract.Args
	if len(args) != 3 {
		t.Fatalf("got %d args, want 3 (judge, event_id, winners)", len(args))
	}
	assertAccountAddress(t, args[0], testJudgeAddress)
	gotID, err := EventIDFromScVal(args[1])
	if err != nil {
		t.Fatalf("decoding event_id arg: %v", err)
	}
	if gotID != eventID {
		t.Fatalf("event_id arg = %x, want %x", gotID, eventID)
	}

	vec, ok := args[2].GetVec()
	if !ok || vec == nil {
		t.Fatalf("winners arg = %+v, want an ScvVec", args[2])
	}
	if len(*vec) != 1 {
		t.Fatalf("got %d winners in the vec, want 1", len(*vec))
	}
}

func TestReleaseRewardHostFunction_MultipleWinners(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	winners := []Winner{
		{Place: 1, Amount: 20_000_000, Address: testWinner1Address},
		{Place: 2, Amount: 7_000_000, Address: testWinner2Address},
		{Place: 2, Amount: 3_000_000, Address: testWinner3Address},
	}

	hf, err := ReleaseRewardHostFunction(contract, testJudgeAddress, eventID, winners)
	if err != nil {
		t.Fatalf("ReleaseRewardHostFunction returned error: %v", err)
	}

	args := hf.InvokeContract.Args
	vec, ok := args[2].GetVec()
	if !ok || vec == nil {
		t.Fatalf("winners arg = %+v, want an ScvVec", args[2])
	}
	if len(*vec) != len(winners) {
		t.Fatalf("got %d winners in the vec, want %d", len(*vec), len(winners))
	}

	// Order is preserved, and each entry decodes back to its source Winner
	// -- proves this isn't just "3 maps of the right shape" but the right
	// maps in the right order.
	for i, w := range winners {
		entries, ok := (*vec)[i].GetMap()
		if !ok || entries == nil {
			t.Fatalf("winner %d = %+v, want an ScvMap", i, (*vec)[i])
		}
		m := *entries
		assertAccountAddress(t, m[0].Val, w.Address)
		assertI128(t, m[1].Val, w.Amount)
		if got := uint32(*m[2].Val.U32); got != w.Place {
			t.Fatalf("winner %d place = %d, want %d", i, got, w.Place)
		}
	}
}

func TestReleaseRewardHostFunction_TooManyWinners(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	winners := make([]Winner, maxWinners+1)
	for i := range winners {
		winners[i] = Winner{Place: 1, Amount: 1, Address: testWinner1Address}
	}

	_, err = ReleaseRewardHostFunction(contract, testJudgeAddress, eventID, winners)
	if err == nil {
		t.Fatal("expected an error for a winners list exceeding MAX_WINNERS, got nil")
	}
}

func TestReleaseRewardHostFunction_NoWinners(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}

	_, err = ReleaseRewardHostFunction(contract, testJudgeAddress, eventID, nil)
	if err == nil {
		t.Fatal("expected an error for an empty winners list, got nil")
	}
}

// --- release_compensation --------------------------------------------------

func TestReleaseCompensationHostFunction(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	participants := []Participant{
		{Address: testWinner1Address, AmountCompensation: 1_000_000},
		{Address: testWinner2Address, AmountCompensation: 2_000_000},
	}

	hf, err := ReleaseCompensationHostFunction(contract, testAccountAddress, eventID, participants)
	if err != nil {
		t.Fatalf("ReleaseCompensationHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "release_compensation" {
		t.Fatalf("function name = %q, want %q", got, "release_compensation")
	}
	args := hf.InvokeContract.Args
	if len(args) != 3 {
		t.Fatalf("got %d args, want 3 (admin, event_id, participants)", len(args))
	}
	// admin is the signer here, unlike release_reward's judge.
	assertAccountAddress(t, args[0], testAccountAddress)

	vec, ok := args[2].GetVec()
	if !ok || vec == nil {
		t.Fatalf("participants arg = %+v, want an ScvVec", args[2])
	}
	if len(*vec) != len(participants) {
		t.Fatalf("got %d participants in the vec, want %d", len(*vec), len(participants))
	}
}

// --- BuildUnsigned wrappers -------------------------------------------------

func TestBuildSetEventCancelled_ReturnsUnsignedEnvelope(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})

	unsigned, err := BuildSetEventCancelled(context.Background(), rpc, contract, testAccountAddress, eventID, Config{})
	if err != nil {
		t.Fatalf("BuildSetEventCancelled returned error: %v", err)
	}
	assertUnsignedEnvelope(t, unsigned)
}

func TestBuildExpireEvent_ReturnsUnsignedEnvelope(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})

	// feePayer here plays Astrea's operational account, not the event's
	// admin or judge -- expire_event has no signer to speak for.
	unsigned, err := BuildExpireEvent(context.Background(), rpc, contract, testAccountAddress, eventID, Config{})
	if err != nil {
		t.Fatalf("BuildExpireEvent returned error: %v", err)
	}
	assertUnsignedEnvelope(t, unsigned)
}

func TestBuildReleaseReward_ReturnsUnsignedEnvelope(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	winners := []Winner{{Place: 1, Amount: 10, Address: testWinner1Address}}

	unsigned, err := BuildReleaseReward(context.Background(), rpc, contract, testJudgeAddress, eventID, winners, Config{})
	if err != nil {
		t.Fatalf("BuildReleaseReward returned error: %v", err)
	}
	assertUnsignedEnvelope(t, unsigned)
}

func TestBuildReleaseCompensation_ReturnsUnsignedEnvelope(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	participants := []Participant{{Address: testWinner1Address, AmountCompensation: 10}}

	unsigned, err := BuildReleaseCompensation(context.Background(), rpc, contract, testAccountAddress, eventID, participants, Config{})
	if err != nil {
		t.Fatalf("BuildReleaseCompensation returned error: %v", err)
	}
	assertUnsignedEnvelope(t, unsigned)
}

// assertUnsignedEnvelope proves an UnsignedTx carries a parseable
// transaction with no signatures attached, the same invariant
// TestBuildDepositFunds_ReturnsUnsignedEnvelope checks in wallet_test.go.
func assertUnsignedEnvelope(t *testing.T, unsigned UnsignedTx) {
	t.Helper()
	if unsigned.XDR == "" {
		t.Fatal("Build... returned an empty XDR envelope")
	}
	generic, err := txnbuild.TransactionFromXDR(unsigned.XDR)
	if err != nil {
		t.Fatalf("parsing unsigned envelope: %v", err)
	}
	tx, ok := generic.Transaction()
	if !ok {
		t.Fatal("unsigned envelope is not a simple transaction")
	}
	if n := len(tx.Signatures()); n != 0 {
		t.Fatalf("unsigned envelope has %d signatures, want 0", n)
	}
}
