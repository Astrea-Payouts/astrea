package escrow

import (
	"context"
	"testing"

	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

// Real testnet strkeys reused purely as well-formed addresses, same as
// wallet_test.go and pipeline_test.go -- none of these tests touch the
// network.
const (
	testWinner1Address  = "GBXNBZFHSILK4HNBOVGANXADKY6FGJYH2R253PBPT4QF3CXEFJXBU27X"
	testWinner2Address  = "GBLH7BFPOM5AUYM7E64SP25AR6HOUM3IDSZEFM6OEBHRVEM67JQZPEQA"
	testWinner3Address  = "GCRN2BZIQPZ3AYMJUWB2FTQQD2BFQYCFS6UF7ELWIC2RRDTDXND4XI23"
	testResolverAddress = "GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L"
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

// --- set_event_waiting_for_start / set_event_in_progress -----------------

func TestSetEventWaitingForStartHostFunction(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}

	hf, err := SetEventWaitingForStartHostFunction(contract, testAccountAddress, eventID)
	if err != nil {
		t.Fatalf("SetEventWaitingForStartHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "set_event_waiting_for_start" {
		t.Fatalf("function name = %q, want %q", got, "set_event_waiting_for_start")
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

// TestSetEventInProgressHostFunction_JudgingDeadlineIsU64 is the regression
// test for this task's second encoding gotcha: judging_deadline is a u64 in
// lifecycle.rs (PR #178), so it must encode as ScvU64. Encoding it as ScvU32
// instead would silently truncate any deadline past 2^32 seconds and, more
// immediately, simulation would reject the argument type outright.
func TestSetEventInProgressHostFunction_JudgingDeadlineIsU64(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	const judgingDeadline = uint64(4102444800) // 2100-01-01, well past 2^32-1

	hf, err := SetEventInProgressHostFunction(contract, testAccountAddress, eventID, judgingDeadline)
	if err != nil {
		t.Fatalf("SetEventInProgressHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "set_event_in_progress" {
		t.Fatalf("function name = %q, want %q", got, "set_event_in_progress")
	}
	args := hf.InvokeContract.Args
	if len(args) != 3 {
		t.Fatalf("got %d args, want 3 (admin, event_id, judging_deadline)", len(args))
	}
	assertAccountAddress(t, args[0], testAccountAddress)
	gotID, err := EventIDFromScVal(args[1])
	if err != nil {
		t.Fatalf("decoding event_id arg: %v", err)
	}
	if gotID != eventID {
		t.Fatalf("event_id arg = %x, want %x", gotID, eventID)
	}

	deadlineArg := args[2]
	if deadlineArg.Type != xdr.ScValTypeScvU64 || deadlineArg.U64 == nil {
		t.Fatalf("judging_deadline arg = %+v, want ScvU64", deadlineArg)
	}
	if got := uint64(*deadlineArg.U64); got != judgingDeadline {
		t.Fatalf("judging_deadline arg = %d, want %d", got, judgingDeadline)
	}
}

func TestBuildSetEventWaitingForStart_ReturnsUnsignedEnvelope(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})

	unsigned, err := BuildSetEventWaitingForStart(context.Background(), rpc, contract, testAccountAddress, eventID, Config{})
	if err != nil {
		t.Fatalf("BuildSetEventWaitingForStart returned error: %v", err)
	}
	assertUnsignedEnvelope(t, unsigned)
}

func TestBuildSetEventInProgress_ReturnsUnsignedEnvelope(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})

	unsigned, err := BuildSetEventInProgress(context.Background(), rpc, contract, testAccountAddress, eventID, 4102444800, Config{})
	if err != nil {
		t.Fatalf("BuildSetEventInProgress returned error: %v", err)
	}
	assertUnsignedEnvelope(t, unsigned)
}

// --- quote_go_live_fee -------------------------------------------------------

func TestQuoteGoLiveFee_NeverSubmits(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	sorobanDataB64, err := xdr.MarshalBase64(xdr.SorobanTransactionData{})
	if err != nil {
		t.Fatalf("marshaling empty SorobanTransactionData: %v", err)
	}
	returnValB64, err := xdr.MarshalBase64(xdr.ScVal{Type: xdr.ScValTypeScvI128, I128: &xdr.Int128Parts{Hi: 0, Lo: 15_000}})
	if err != nil {
		t.Fatalf("marshaling test return value: %v", err)
	}

	rpc := &mockRPC{
		loadAccountFn: func(_ context.Context, address string) (txnbuild.Account, error) {
			return &txnbuild.SimpleAccount{AccountID: address, Sequence: 1}, nil
		},
		simulateFn: func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
			return protocol.SimulateTransactionResponse{
				TransactionDataXDR: sorobanDataB64,
				MinResourceFee:     100,
				Results: []protocol.SimulateHostFunctionResult{
					{ReturnValueXDR: &returnValB64},
				},
			}, nil
		},
		// sendFn and getFn are deliberately nil, same reasoning as
		// TestGetBalance_NeverSubmits in wallet_test.go.
	}

	fee, err := QuoteGoLiveFee(context.Background(), rpc, contract, eventID, testAccountAddress, Config{})
	if err != nil {
		t.Fatalf("QuoteGoLiveFee returned error: %v", err)
	}
	if fee != 15_000 {
		t.Fatalf("fee = %d, want 15000", fee)
	}
}

// --- resolve_dispute -----------------------------------------------------

func TestResolveDisputeHostFunction(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	winners := []Winner{
		{Place: 1, Amount: 4_000_000, Address: testWinner1Address},
		{Place: 1, Amount: 1_000_000, Address: testAccountAddress}, // cancel-after-launch: organizer as "winner"
	}

	hf, err := ResolveDisputeHostFunction(contract, testResolverAddress, eventID, winners)
	if err != nil {
		t.Fatalf("ResolveDisputeHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "resolve_dispute" {
		t.Fatalf("function name = %q, want %q", got, "resolve_dispute")
	}
	args := hf.InvokeContract.Args
	if len(args) != 3 {
		t.Fatalf("got %d args, want 3 (resolver, event_id, winners)", len(args))
	}
	assertAccountAddress(t, args[0], testResolverAddress)
	gotID, err := EventIDFromScVal(args[1])
	if err != nil {
		t.Fatalf("decoding event_id arg: %v", err)
	}
	if gotID != eventID {
		t.Fatalf("event_id arg = %x, want %x", gotID, eventID)
	}
	vec, ok := args[2].GetVec()
	if !ok || vec == nil || len(*vec) != 2 {
		t.Fatalf("winners arg = %+v, want a 2-element ScvVec", args[2])
	}
}

func TestResolveDisputeHostFunction_NoWinners(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	_, err = ResolveDisputeHostFunction(contract, testResolverAddress, eventID, nil)
	if err == nil {
		t.Fatal("expected an error for an empty winners list, got nil")
	}
}

func TestBuildResolveDispute_ReturnsUnsignedEnvelope(t *testing.T) {
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

	unsigned, err := BuildResolveDispute(context.Background(), rpc, contract, testResolverAddress, eventID, winners, Config{})
	if err != nil {
		t.Fatalf("BuildResolveDispute returned error: %v", err)
	}
	assertUnsignedEnvelope(t, unsigned)
}

// --- emergency_withdraw ------------------------------------------------------

// TestEmergencyWithdrawHostFunction_ArgumentOrder pins the exact argument
// order the contract expects: emergency_withdraw(admin, resolver, event_id,
// amount) (lifecycle.rs) -- admin before resolver, matching neither
// alphabetical nor "who signs first" order, so it is worth asserting
// directly rather than trusting the Go parameter order to carry it.
func TestEmergencyWithdrawHostFunction_ArgumentOrder(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}

	hf, err := EmergencyWithdrawHostFunction(contract, testAccountAddress, testResolverAddress, eventID, 2_000_000)
	if err != nil {
		t.Fatalf("EmergencyWithdrawHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "emergency_withdraw" {
		t.Fatalf("function name = %q, want %q", got, "emergency_withdraw")
	}
	args := hf.InvokeContract.Args
	if len(args) != 4 {
		t.Fatalf("got %d args, want 4 (admin, resolver, event_id, amount)", len(args))
	}
	assertAccountAddress(t, args[0], testAccountAddress)
	assertAccountAddress(t, args[1], testResolverAddress)
	gotID, err := EventIDFromScVal(args[2])
	if err != nil {
		t.Fatalf("decoding event_id arg: %v", err)
	}
	if gotID != eventID {
		t.Fatalf("event_id arg = %x, want %x", gotID, eventID)
	}
	assertI128(t, args[3], 2_000_000)
}

func TestBuildEmergencyWithdraw_SourceMustBeAdminOrResolver(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})

	_, err = BuildEmergencyWithdraw(context.Background(), rpc, contract, testWinner1Address, testAccountAddress, testResolverAddress, eventID, 1_000, Config{})
	if err == nil {
		t.Fatal("expected an error when source is neither admin nor resolver, got nil")
	}
}

// TestBuildEmergencyWithdraw_OtherPartyIsPending proves the two-signature
// shape end to end: with admin as source, the resolver's entry -- and only
// the resolver's -- surfaces in PendingAuth.
func TestBuildEmergencyWithdraw_OtherPartyIsPending(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	sourceEntry := xdr.SorobanAuthorizationEntry{
		Credentials:    xdr.SorobanCredentials{Type: xdr.SorobanCredentialsTypeSorobanCredentialsSourceAccount},
		RootInvocation: testInvocation(t),
	}
	resolverEntry := testAuthAddressCredentials(t, testResolverAddress, 1, 0)
	rpc := happyMockRPCWithAuth(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid}, []xdr.SorobanAuthorizationEntry{sourceEntry, resolverEntry})

	unsigned, err := BuildEmergencyWithdraw(context.Background(), rpc, contract, testAccountAddress, testAccountAddress, testResolverAddress, eventID, 1_000, Config{})
	if err != nil {
		t.Fatalf("BuildEmergencyWithdraw returned error: %v", err)
	}
	if len(unsigned.PendingAuth) != 1 {
		t.Fatalf("PendingAuth has %d entries, want 1", len(unsigned.PendingAuth))
	}
	if !unsigned.PendingAuth[0].Credentials.Address.Address.Equals(resolverEntry.Credentials.Address.Address) {
		t.Fatalf("pending entry address = %+v, want the resolver's", unsigned.PendingAuth[0].Credentials.Address.Address)
	}
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
