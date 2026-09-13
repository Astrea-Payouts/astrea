// Command escrow-testnet-proof is a manual, network-touching harness that
// proves internal/escrow against the real, already-deployed event-escrow
// contract on Stellar testnet (see
// smart-contracts/astrea/contracts/event-escrow/README.md for that
// deployment's own proof).
//
// E01a/E01b (steps 1-5): deposit_funds/create_event/get_balance/get_event,
// unchanged from the original harness.
//
// E01c (steps 6-9) exercises the four lifecycle-ending calls added in
// lifecycle.go, against three more events reserved out of the same
// AdminWallet deposit:
//
//   - Event B is driven to InProgress and closed with release_reward, paid
//     out to a 3-member team via escrow.AllocateWinners with an uneven
//     3333/3333/3334 bp split on an amount not divisible by 3 -- so the
//     schema's remainder rule (lowest Ordinal gets the leftover unit) is
//     exercised on a real ledger, not just in a unit test.
//   - Event C is cancelled with set_event_cancelled while still Created
//     (pre-launch) -- the successful-cancellation proof.
//   - Event D is driven to InProgress and then also has
//     set_event_cancelled attempted on it -- proving, against the
//     contract itself rather than client-side, that InProgress rejects
//     cancellation (ADR-006; see lifecycle.rs).
//
// set_event_waiting_for_start/set_event_in_progress have no Go wrapper in
// internal/escrow (out of this issue's scope -- E01c is only
// set_event_cancelled/expire_event/release_reward/release_compensation),
// so this harness builds those two host functions inline, the same way it
// already inlines get_event below.
//
// This is deliberately a `main`, not a `go test`: it hits friendbot and a
// real RPC endpoint, so its success depends on external services being up,
// which would make `go test ./...` (run unconditionally in CI) flaky. Run
// it explicitly:
//
//	go run ./cmd/escrow-testnet-proof
package main

import (
	"context"
	"fmt"
	"log"
	"math"
	"strconv"

	"github.com/stellar/go/clients/horizonclient"
	rpcclient "github.com/stellar/go/clients/rpcclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
)

const (
	rpcURL = "https://soroban-testnet.stellar.org"
	// event-escrow, deployed to testnet in E03. See
	// smart-contracts/astrea/contracts/event-escrow/README.md. Confirmed
	// still live for this task (2026-09-12) via
	// `stellar contract info interface --id ... --network testnet`: it
	// resolves and its create_event/set_event_cancelled/expire_event/
	// release_reward/release_compensation signatures match what this
	// harness and internal/escrow/lifecycle.go build against. Its
	// create_event has no `resolver` parameter and it has no
	// emergency_withdraw -- both landed on develop's contract source
	// after this instance was deployed -- but neither affects the four
	// E01c calls this harness proves, so no redeployment was needed.
	contractID = "CAD5IOA2FFSUTRIHEK6YQ2BPO2JVDPXYRXBVMPBBWFQEWRWKFRG36TQH"
	// Reserved across four events below (eventReward + teamReward +
	// cancelledEventReward + inProgressRejectReward = 24,000,001 stroops);
	// deposited with headroom rather than trimmed to the exact total.
	depositAmount = int64(60_000_000)
	// Event A (E01b's original scenario): reserve less than the full
	// deposit so the post-create_event balance check actually distinguishes
	// "reward was deducted" from "wallet was zeroed out".
	eventReward = int64(4_000_000)
	// Event B: deliberately not a multiple of 3, so a 3333/3333/3334 bp
	// split leaves a real 1-stroop remainder for the lowest-Ordinal member
	// to absorb -- the scenario the PR description asks for explicitly.
	teamReward = int64(10_000_001)
	// Event C: cancelled pre-launch (Created state) -- the
	// successful-cancellation proof.
	cancelledEventReward = int64(5_000_000)
	// Event D: driven to InProgress, then cancellation is attempted and
	// must be rejected by the contract.
	inProgressRejectReward = int64(5_000_000)
)

func main() {
	ctx := context.Background()
	rpc := rpcclient.NewClient(rpcURL, nil)
	horizon := horizonclient.DefaultTestNetClient

	admin, err := keypair.Random()
	if err != nil {
		log.Fatalf("generating admin keypair: %v", err)
	}
	fmt.Println("admin:", admin.Address())
	if _, err := horizon.Fund(admin.Address()); err != nil {
		log.Fatalf("funding admin via friendbot: %v", err)
	}

	// Unlike E01b, judge now signs a real call (release_reward), so it
	// needs an existing, funded account too: BuildReleaseReward loads it
	// as the transaction's source account.
	judge, err := keypair.Random()
	if err != nil {
		log.Fatalf("generating judge keypair: %v", err)
	}
	fmt.Println("judge:", judge.Address())
	if _, err := horizon.Fund(judge.Address()); err != nil {
		log.Fatalf("funding judge via friendbot: %v", err)
	}

	teamMember1, teamMember2, teamMember3 := mustRandomKeypair(), mustRandomKeypair(), mustRandomKeypair()
	for _, member := range []*keypair.Full{teamMember1, teamMember2, teamMember3} {
		if _, err := horizon.Fund(member.Address()); err != nil {
			log.Fatalf("funding team member %s via friendbot: %v", member.Address(), err)
		}
	}
	fmt.Println("team member 1 (ordinal 0, 3333 bp):", teamMember1.Address())
	fmt.Println("team member 2 (ordinal 1, 3333 bp):", teamMember2.Address())
	fmt.Println("team member 3 (ordinal 2, 3334 bp):", teamMember3.Address())

	token, err := nativeAssetContractID()
	if err != nil {
		log.Fatalf("deriving native XLM SAC contract id: %v", err)
	}
	fmt.Println("token:", token)

	contractAddr, err := escrow.ContractAddress(contractID)
	if err != nil {
		log.Fatalf("decoding event-escrow contract address: %v", err)
	}

	fmt.Println("\n[1/9] deposit_funds(admin, token, amount) -- via escrow.Submit (E01a path)")
	depositHF, err := escrow.DepositFundsHostFunction(contractAddr, admin.Address(), token, depositAmount)
	if err != nil {
		log.Fatalf("building deposit_funds host function: %v", err)
	}
	depositResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, depositHF, escrow.Config{})
	if err != nil {
		log.Fatalf("deposit_funds failed: %v", err)
	}
	fmt.Println("  tx hash:", depositResult.Hash)

	fmt.Println("\n[2/9] get_balance(admin) -- via escrow.GetBalance, simulation only, nothing submitted")
	balanceAfterDeposit, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance failed: %v", err)
	}
	fmt.Printf("  balance: %d stroops (want %d)\n", balanceAfterDeposit, depositAmount)
	if balanceAfterDeposit != depositAmount {
		log.Fatalf("balance mismatch after deposit: got %d, want %d", balanceAfterDeposit, depositAmount)
	}

	eventIDA, err := escrow.NewEventID()
	if err != nil {
		log.Fatalf("generating event id: %v", err)
	}
	fmt.Println("\n[3/9] create_event(admin, judge, token, reward, event_id) (A) -- via escrow.BuildCreateEvent + escrow.SubmitSigned (E01b non-custodial path)")
	fmt.Println("  event_id:", eventIDA)
	unsignedA, err := escrow.BuildCreateEvent(ctx, rpc, contractAddr, admin.Address(), judge.Address(), token, eventReward, eventIDA, escrow.Config{})
	if err != nil {
		log.Fatalf("building create_event(A) transaction: %v", err)
	}
	signedAXDR, err := signTransaction(unsignedA.XDR, admin)
	if err != nil {
		log.Fatalf("signing create_event(A) transaction: %v", err)
	}
	createAResult, err := escrow.SubmitSigned(ctx, rpc, signedAXDR, escrow.Config{})
	if err != nil {
		log.Fatalf("submitting signed create_event(A) transaction: %v", err)
	}
	fmt.Println("  tx hash:", createAResult.Hash)

	fmt.Println("\n[4/9] get_balance(admin) -- confirms create_event(A) reserved the reward out of the free balance")
	balanceAfterCreateA, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance failed: %v", err)
	}
	wantBalanceAfterA := depositAmount - eventReward
	fmt.Printf("  balance: %d stroops (want %d)\n", balanceAfterCreateA, wantBalanceAfterA)
	if balanceAfterCreateA != wantBalanceAfterA {
		log.Fatalf("balance mismatch after create_event(A): got %d, want %d", balanceAfterCreateA, wantBalanceAfterA)
	}

	fmt.Println("\n[5/9] get_event(event_id) (A) -- read-only, via escrow.Submit purely as a transaction envelope (no auth required)")
	getEventHF := invokeContractHF(contractAddr, "get_event", eventIDArg(eventIDA))
	getEventResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, getEventHF, escrow.Config{})
	if err != nil {
		log.Fatalf("get_event failed: %v", err)
	}
	fmt.Println("  tx hash:", getEventResult.Hash)
	fmt.Println("  raw event:", getEventResult.ReturnValue.String())

	judgeField, ok := mapField(getEventResult.ReturnValue, "judge")
	if !ok || judgeField.Address == nil {
		log.Fatalf("event has no judge field, got %+v", getEventResult.ReturnValue)
	}
	gotJudge, err := judgeField.Address.String()
	if err != nil {
		log.Fatalf("decoding judge address from event: %v", err)
	}
	fmt.Println("  judge:", gotJudge, "(want", judge.Address()+")")
	if gotJudge != judge.Address() {
		log.Fatalf("event judge mismatch: got %s, want %s", gotJudge, judge.Address())
	}

	rewardField, ok := mapField(getEventResult.ReturnValue, "reward")
	if !ok {
		log.Fatalf("event has no reward field, got %+v", getEventResult.ReturnValue)
	}
	gotReward, err := escrow.DecodeI128ToInt64(rewardField)
	if err != nil {
		log.Fatalf("decoding reward from event: %v", err)
	}
	fmt.Printf("  reward: %d stroops (want %d)\n", gotReward, eventReward)
	if gotReward != eventReward {
		log.Fatalf("event reward mismatch: got %d, want %d", gotReward, eventReward)
	}

	// --- E01c: release_reward, to a team, with a real remainder ------------

	eventIDB, err := escrow.NewEventID()
	if err != nil {
		log.Fatalf("generating event id: %v", err)
	}
	fmt.Println("\n[6/9] create_event (B) + set_event_waiting_for_start + set_event_in_progress -- driving B to InProgress so release_reward is legal")
	fmt.Println("  event_id:", eventIDB)
	createBHF, err := escrow.CreateEventHostFunction(contractAddr, admin.Address(), judge.Address(), token, teamReward, eventIDB)
	if err != nil {
		log.Fatalf("building create_event(B) host function: %v", err)
	}
	createBResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, createBHF, escrow.Config{})
	if err != nil {
		log.Fatalf("create_event(B) failed: %v", err)
	}
	fmt.Println("  create_event(B) tx hash:", createBResult.Hash)

	waitingBHF, err := setEventWaitingForStartHF(contractAddr, admin.Address(), eventIDB)
	if err != nil {
		log.Fatalf("building set_event_waiting_for_start(B) host function: %v", err)
	}
	if _, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, waitingBHF, escrow.Config{}); err != nil {
		log.Fatalf("set_event_waiting_for_start(B) failed: %v", err)
	}
	inProgressBHF, err := setEventInProgressHF(contractAddr, admin.Address(), eventIDB)
	if err != nil {
		log.Fatalf("building set_event_in_progress(B) host function: %v", err)
	}
	inProgressBResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, inProgressBHF, escrow.Config{})
	if err != nil {
		log.Fatalf("set_event_in_progress(B) failed: %v", err)
	}
	fmt.Println("  set_event_in_progress(B) tx hash:", inProgressBResult.Hash)

	fmt.Println("\n[7/9] release_reward(judge, event_id, winners) (B) -- AllocateWinners splits 3333/3333/3334 bp of a reward not divisible by 3, so the remainder rule fires for real")
	positions := []escrow.Position{{Place: 1, Amount: teamReward}}
	teams := []escrow.WinningTeam{{
		Place: 1,
		Members: []escrow.Member{
			{Address: teamMember1.Address(), Ordinal: 0, ShareBasisPoints: 3333},
			{Address: teamMember2.Address(), Ordinal: 1, ShareBasisPoints: 3333},
			{Address: teamMember3.Address(), Ordinal: 2, ShareBasisPoints: 3334},
		},
	}}
	winners, err := escrow.AllocateWinners(teamReward, positions, teams)
	if err != nil {
		log.Fatalf("AllocateWinners failed: %v", err)
	}
	for _, w := range winners {
		fmt.Printf("  allocated: %s -> %d stroops (place %d)\n", w.Address, w.Amount, w.Place)
	}

	balancesBefore := map[string]int64{}
	for _, member := range []*keypair.Full{teamMember1, teamMember2, teamMember3} {
		bal, err := nativeBalanceStroops(horizon, member.Address())
		if err != nil {
			log.Fatalf("reading pre-release balance for %s: %v", member.Address(), err)
		}
		balancesBefore[member.Address()] = bal
	}

	unsignedRelease, err := escrow.BuildReleaseReward(ctx, rpc, contractAddr, judge.Address(), eventIDB, winners, escrow.Config{})
	if err != nil {
		log.Fatalf("building release_reward transaction: %v", err)
	}
	// judge, not admin, signs release_reward -- the organizer is never in
	// the payout path (ADR-003).
	signedReleaseXDR, err := signTransaction(unsignedRelease.XDR, judge)
	if err != nil {
		log.Fatalf("signing release_reward transaction: %v", err)
	}
	releaseResult, err := escrow.SubmitSigned(ctx, rpc, signedReleaseXDR, escrow.Config{})
	if err != nil {
		log.Fatalf("submitting signed release_reward transaction: %v", err)
	}
	fmt.Println("  release_reward tx hash:", releaseResult.Hash)

	fmt.Println("  on-chain transfer amounts (post-release balance delta):")
	var totalTransferred int64
	for _, w := range winners {
		after, err := nativeBalanceStroops(horizon, w.Address)
		if err != nil {
			log.Fatalf("reading post-release balance for %s: %v", w.Address, err)
		}
		delta := after - balancesBefore[w.Address]
		fmt.Printf("    %s: +%d stroops (want %d)\n", w.Address, delta, w.Amount)
		if delta != w.Amount {
			log.Fatalf("transfer amount mismatch for %s: got %d, want %d", w.Address, delta, w.Amount)
		}
		totalTransferred += delta
	}
	if totalTransferred != teamReward {
		log.Fatalf("total transferred %d does not match event reward %d", totalTransferred, teamReward)
	}

	// --- E01c: a successful pre-launch cancellation -------------------------

	eventIDC, err := escrow.NewEventID()
	if err != nil {
		log.Fatalf("generating event id: %v", err)
	}
	fmt.Println("\n[8/9] create_event (C) + set_event_cancelled -- pre-launch (Created state) cancel-and-refund")
	fmt.Println("  event_id:", eventIDC)
	createCHF, err := escrow.CreateEventHostFunction(contractAddr, admin.Address(), judge.Address(), token, cancelledEventReward, eventIDC)
	if err != nil {
		log.Fatalf("building create_event(C) host function: %v", err)
	}
	createCResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, createCHF, escrow.Config{})
	if err != nil {
		log.Fatalf("create_event(C) failed: %v", err)
	}
	fmt.Println("  create_event(C) tx hash:", createCResult.Hash)

	balanceBeforeCancelC, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance before cancel(C) failed: %v", err)
	}

	cancelCHF, err := escrow.SetEventCancelledHostFunction(contractAddr, admin.Address(), eventIDC)
	if err != nil {
		log.Fatalf("building set_event_cancelled(C) host function: %v", err)
	}
	cancelCResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, cancelCHF, escrow.Config{})
	if err != nil {
		log.Fatalf("set_event_cancelled(C) failed (expected to succeed pre-launch): %v", err)
	}
	fmt.Println("  set_event_cancelled(C) tx hash:", cancelCResult.Hash)

	balanceAfterCancelC, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance after cancel(C) failed: %v", err)
	}
	wantBalanceAfterCancelC := balanceBeforeCancelC + cancelledEventReward
	fmt.Printf("  balance: %d stroops (want %d, i.e. reward refunded)\n", balanceAfterCancelC, wantBalanceAfterCancelC)
	if balanceAfterCancelC != wantBalanceAfterCancelC {
		log.Fatalf("balance mismatch after cancel(C): got %d, want %d", balanceAfterCancelC, wantBalanceAfterCancelC)
	}

	// --- E01c: InProgress rejects cancellation, proven against the contract -

	eventIDD, err := escrow.NewEventID()
	if err != nil {
		log.Fatalf("generating event id: %v", err)
	}
	fmt.Println("\n[9/9] create_event (D) -> InProgress -> set_event_cancelled MUST be rejected by the contract (ADR-006)")
	fmt.Println("  event_id:", eventIDD)
	createDHF, err := escrow.CreateEventHostFunction(contractAddr, admin.Address(), judge.Address(), token, inProgressRejectReward, eventIDD)
	if err != nil {
		log.Fatalf("building create_event(D) host function: %v", err)
	}
	if _, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, createDHF, escrow.Config{}); err != nil {
		log.Fatalf("create_event(D) failed: %v", err)
	}
	waitingDHF, err := setEventWaitingForStartHF(contractAddr, admin.Address(), eventIDD)
	if err != nil {
		log.Fatalf("building set_event_waiting_for_start(D) host function: %v", err)
	}
	if _, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, waitingDHF, escrow.Config{}); err != nil {
		log.Fatalf("set_event_waiting_for_start(D) failed: %v", err)
	}
	inProgressDHF, err := setEventInProgressHF(contractAddr, admin.Address(), eventIDD)
	if err != nil {
		log.Fatalf("building set_event_in_progress(D) host function: %v", err)
	}
	if _, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, inProgressDHF, escrow.Config{}); err != nil {
		log.Fatalf("set_event_in_progress(D) failed: %v", err)
	}
	fmt.Println("  event D is now InProgress; attempting set_event_cancelled (expected to be rejected)...")

	cancelDHF, err := escrow.SetEventCancelledHostFunction(contractAddr, admin.Address(), eventIDD)
	if err != nil {
		log.Fatalf("building set_event_cancelled(D) host function: %v", err)
	}
	if _, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, cancelDHF, escrow.Config{}); err == nil {
		log.Fatal("expected set_event_cancelled to be rejected once InProgress, but it succeeded -- ADR-006 is violated")
	} else {
		fmt.Println("  rejected as expected, simulation error:")
		fmt.Println("   ", err)
	}

	fmt.Println("\ndone")
	fmt.Println("\nE01c testnet round-trip complete: release_reward to a team with a real remainder (B), a pre-launch cancellation (C), and a proven InProgress cancel rejection (D).")
	fmt.Println("contract:", contractID)
}

// mustRandomKeypair panics on error -- acceptable in this manual harness,
// which already treats every failure as fatal.
func mustRandomKeypair() *keypair.Full {
	kp, err := keypair.Random()
	if err != nil {
		log.Fatalf("generating keypair: %v", err)
	}
	return kp
}

// nativeAssetContractID returns the deterministic contract id of the native
// XLM Stellar Asset Contract on testnet (same value for everyone).
func nativeAssetContractID() (string, error) {
	asset := xdr.Asset{Type: xdr.AssetTypeAssetTypeNative}
	id, err := asset.ContractID(network.TestNetworkPassphrase)
	if err != nil {
		return "", err
	}
	return strkey.Encode(strkey.VersionByteContract, id[:])
}

// nativeBalanceStroops reads address's classic native XLM balance (visible
// via Horizon even though transfers move through the SAC/Soroban side) and
// converts it to stroops, for before/after delta checks around
// release_reward.
func nativeBalanceStroops(horizon *horizonclient.Client, address string) (int64, error) {
	account, err := horizon.AccountDetail(horizonclient.AccountRequest{AccountID: address})
	if err != nil {
		return 0, fmt.Errorf("loading account %s: %w", address, err)
	}
	for _, b := range account.Balances {
		if b.Asset.Type != "native" {
			continue
		}
		xlm, err := strconv.ParseFloat(b.Balance, 64)
		if err != nil {
			return 0, fmt.Errorf("parsing native balance %q: %w", b.Balance, err)
		}
		return int64(math.Round(xlm * 1e7)), nil
	}
	return 0, fmt.Errorf("no native balance entry for %s", address)
}

// signTransaction stands in for an organizer's (or judge's) wallet: it
// parses the unsigned envelope a Build... function produced, signs it, and
// re-encodes it, all using the same txnbuild API a real wallet would use.
func signTransaction(unsignedXDR string, signer *keypair.Full) (string, error) {
	generic, err := txnbuild.TransactionFromXDR(unsignedXDR)
	if err != nil {
		return "", fmt.Errorf("parsing unsigned envelope: %w", err)
	}
	tx, ok := generic.Transaction()
	if !ok {
		return "", fmt.Errorf("unsigned envelope is not a simple transaction")
	}
	signed, err := tx.Sign(network.TestNetworkPassphrase, signer)
	if err != nil {
		return "", fmt.Errorf("signing transaction: %w", err)
	}
	return signed.Base64()
}

func invokeContractHF(contract xdr.ScAddress, fn string, args ...xdr.ScVal) xdr.HostFunction {
	return xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
		InvokeContract: &xdr.InvokeContractArgs{
			ContractAddress: contract,
			FunctionName:    xdr.ScSymbol(fn),
			Args:            args,
		},
	}
}

// setEventWaitingForStartHF and setEventInProgressHF build the two
// state-transition calls this harness needs to drive an event to
// InProgress before release_reward or the cancel-rejection proof are
// legal. Neither has a Go wrapper in internal/escrow -- out of E01c's
// scope, which is only the four lifecycle-*ending* calls -- so they are
// built inline here, the same way get_event already is.
func setEventWaitingForStartHF(contract xdr.ScAddress, admin string, eventID escrow.EventID) (xdr.HostFunction, error) {
	adminArg, err := escrow.EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("encoding admin address: %w", err)
	}
	return invokeContractHF(contract, "set_event_waiting_for_start", adminArg, eventIDArg(eventID)), nil
}

func setEventInProgressHF(contract xdr.ScAddress, admin string, eventID escrow.EventID) (xdr.HostFunction, error) {
	adminArg, err := escrow.EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("encoding admin address: %w", err)
	}
	return invokeContractHF(contract, "set_event_in_progress", adminArg, eventIDArg(eventID)), nil
}

func eventIDArg(id escrow.EventID) xdr.ScVal {
	b := xdr.ScBytes(append([]byte(nil), id[:]...))
	return xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &b}
}

// mapField looks up key in an ScvMap-encoded contracttype struct (Soroban's
// default struct encoding: a map from field-name symbol to value).
func mapField(v xdr.ScVal, key string) (xdr.ScVal, bool) {
	m, ok := v.GetMap()
	if !ok || m == nil {
		return xdr.ScVal{}, false
	}
	for _, entry := range *m {
		if entry.Key.Type == xdr.ScValTypeScvSymbol && string(*entry.Key.Sym) == key {
			return entry.Val, true
		}
	}
	return xdr.ScVal{}, false
}
