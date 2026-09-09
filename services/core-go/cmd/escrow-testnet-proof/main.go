// Command escrow-testnet-proof is a manual, network-touching harness that
// proves internal/escrow against the real, already-deployed event-escrow
// contract on Stellar testnet (see
// smart-contracts/astrea/contracts/event-escrow/README.md for that
// deployment's own proof).
//
// It runs two escrow.EscrowClient operations through two different paths:
//
//  1. deposit_funds, submitted the E01a way: escrow.Submit signs locally
//     with the admin keypair and submits in one shot. That's correct here
//     because this harness plays the role of both organizer and service.
//  2. create_event, submitted the E01b way: escrow.BuildCreateEvent
//     produces an unsigned, footprint-attached transaction that this
//     service never signs; the harness then plays the role of the
//     organizer's wallet, signing the returned envelope itself, before
//     handing the signed result to escrow.SubmitSigned. This is the shape
//     every organizer-authorized call takes in production, where the
//     signing step happens outside this service entirely.
//
// get_balance (before and after) and get_event are read-only and go
// through escrow.GetBalance / a plain simulate-only call — no signing, no
// submission.
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
	// smart-contracts/astrea/contracts/event-escrow/README.md.
	contractID = "CAD5IOA2FFSUTRIHEK6YQ2BPO2JVDPXYRXBVMPBBWFQEWRWKFRG36TQH"
	// 1 XLM (7 decimals) - small on purpose, this proves the pipeline's
	// wiring, not a funds-handling scenario.
	depositAmount = int64(10_000_000)
	// Reserve less than the full deposit so the post-create_event balance
	// check actually distinguishes "reward was deducted" from "wallet was
	// zeroed out".
	eventReward = int64(4_000_000)
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

	// The judge never signs anything in this harness: create_event only
	// records the address, and release_reward (a later issue) is what would
	// require the judge's own auth. No friendbot funding needed either --
	// judge is never a transaction source here.
	judge, err := keypair.Random()
	if err != nil {
		log.Fatalf("generating judge keypair: %v", err)
	}
	fmt.Println("judge:", judge.Address())

	token, err := nativeAssetContractID()
	if err != nil {
		log.Fatalf("deriving native XLM SAC contract id: %v", err)
	}
	fmt.Println("token:", token)

	contractAddr, err := escrow.ContractAddress(contractID)
	if err != nil {
		log.Fatalf("decoding event-escrow contract address: %v", err)
	}

	fmt.Println("\n[1/6] deposit_funds(admin, token, amount) -- via escrow.Submit (E01a path)")
	depositHF, err := escrow.DepositFundsHostFunction(contractAddr, admin.Address(), token, depositAmount)
	if err != nil {
		log.Fatalf("building deposit_funds host function: %v", err)
	}
	depositResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase, depositHF, escrow.Config{})
	if err != nil {
		log.Fatalf("deposit_funds failed: %v", err)
	}
	fmt.Println("  tx hash:", depositResult.Hash)

	fmt.Println("\n[2/6] get_balance(admin) -- via escrow.GetBalance, simulation only, nothing submitted")
	balanceAfterDeposit, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance failed: %v", err)
	}
	fmt.Printf("  balance: %d stroops (want %d)\n", balanceAfterDeposit, depositAmount)
	if balanceAfterDeposit != depositAmount {
		log.Fatalf("balance mismatch after deposit: got %d, want %d", balanceAfterDeposit, depositAmount)
	}

	eventID, err := escrow.NewEventID()
	if err != nil {
		log.Fatalf("generating event id: %v", err)
	}
	fmt.Println("\n[3/6] create_event(admin, judge, token, reward, event_id) -- via escrow.BuildCreateEvent + escrow.SubmitSigned (E01b non-custodial path)")
	fmt.Println("  event_id:", eventID)
	unsigned, err := escrow.BuildCreateEvent(ctx, rpc, contractAddr, admin.Address(), judge.Address(), token, eventReward, eventID, escrow.Config{})
	if err != nil {
		log.Fatalf("building create_event transaction: %v", err)
	}

	// From here on, this harness is standing in for the organizer's wallet:
	// this service (everything above this line, conceptually) never sees
	// admin's key. In production the unsigned envelope in unsigned.XDR
	// would be handed to the organizer's wallet app over some transport;
	// here we sign it in-process purely because this is a single-binary
	// proof script, not a real non-custodial deployment.
	signedXDR, err := signTransaction(unsigned.XDR, admin)
	if err != nil {
		log.Fatalf("signing create_event transaction: %v", err)
	}
	createResult, err := escrow.SubmitSigned(ctx, rpc, signedXDR, escrow.Config{})
	if err != nil {
		log.Fatalf("submitting signed create_event transaction: %v", err)
	}
	fmt.Println("  tx hash:", createResult.Hash)

	fmt.Println("\n[4/6] get_balance(admin) -- confirms create_event reserved the reward out of the free balance")
	balanceAfterCreate, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance failed: %v", err)
	}
	wantBalance := depositAmount - eventReward
	fmt.Printf("  balance: %d stroops (want %d)\n", balanceAfterCreate, wantBalance)
	if balanceAfterCreate != wantBalance {
		log.Fatalf("balance mismatch after create_event: got %d, want %d", balanceAfterCreate, wantBalance)
	}

	fmt.Println("\n[5/6] get_event(event_id) -- read-only, via escrow.Submit purely as a transaction envelope (no auth required)")
	getEventHF := invokeContractHF(contractAddr, "get_event", eventIDArg(eventID))
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

	fmt.Println("\n[6/6] done")
	fmt.Println("\nE01b testnet round-trip complete: deposit_funds (Submit) + create_event (BuildCreateEvent/SubmitSigned) + get_balance/get_event (read-only).")
	fmt.Println("contract:", contractID)
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

// signTransaction stands in for an organizer's wallet: it parses the
// unsigned envelope escrow.BuildCreateEvent produced, signs it, and
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
