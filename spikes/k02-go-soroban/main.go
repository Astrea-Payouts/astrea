// K02 (server-build-plan.md) — confirms a Go service can build, sign, and
// submit Stellar transactions against the K01 Soroban contract end to end,
// using the Stellar Go SDK directly (no soroban-cli, no shelling out) — the
// role model this validates is "can services/core-go actually do this",
// separate from K01's "does the contract's role model work at all".
//
// Deploys a *fresh* instance of K01's already-compiled wasm (reused from
// ../k01-soroban-escrow, not rebuilt) and drives it through
// initialize -> fund -> approve -> release, entirely from Go.
package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"os"
	"time"

	"github.com/stellar/go/clients/horizonclient"
	client "github.com/stellar/go/clients/rpcclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

const (
	rpcURL   = "https://soroban-testnet.stellar.org"
	wasmPath = "../k01-soroban-escrow/target/wasm32v1-none/release/k01_soroban_escrow.wasm"
	amount   = int64(50_000_000) // 5 XLM at 7 decimals — spike token, not production USDC
)

var networkPassphrase = network.TestNetworkPassphrase

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "\n[FATAL]", err)
		os.Exit(1)
	}
}

func mustV[T any](v T, err error) T {
	must(err)
	return v
}

func step(s string) { fmt.Println("\n[step]", s) }

func main() {
	ctx := context.Background()
	rpc := client.NewClient(rpcURL, nil)
	horizon := horizonclient.DefaultTestNetClient

	step("Generating + funding testnet identities (friendbot via Horizon)")
	organizer := mustV(keypair.Random())
	judge := mustV(keypair.Random())
	resolver := mustV(keypair.Random())
	winner := mustV(keypair.Random())
	fund(horizon, "organizer", organizer)
	fund(horizon, "judge (approver + release_signer)", judge)
	fund(horizon, "resolver", resolver)
	fund(horizon, "winner (unknown to the contract until release)", winner)

	step("Deriving the native-XLM asset contract id (already deployed on testnet)")
	tokenID := mustV(nativeAssetContractID())
	fmt.Println("  token:", tokenID)

	step("Reading the K01 wasm binary")
	wasmBytes := mustV(os.ReadFile(wasmPath))
	wasmHash := sha256.Sum256(wasmBytes)
	fmt.Printf("  wasm: %d bytes, hash %x\n", len(wasmBytes), wasmHash)

	step("Uploading contract wasm")
	_, err := invoke(ctx, rpc, horizon, organizer, xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeUploadContractWasm,
		Wasm: &wasmBytes,
	})
	must(err)

	step("Creating a fresh contract instance from that wasm")
	var salt xdr.Uint256
	_, err = rand.Read(salt[:])
	must(err)
	organizerAccountID := mustV(xdr.AddressToAccountId(organizer.Address()))
	hash := xdr.Hash(wasmHash)
	createResult, err := invoke(ctx, rpc, horizon, organizer, xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeCreateContract,
		CreateContract: &xdr.CreateContractArgs{
			ContractIdPreimage: xdr.ContractIdPreimage{
				Type: xdr.ContractIdPreimageTypeContractIdPreimageFromAddress,
				FromAddress: &xdr.ContractIdPreimageFromAddress{
					Address: xdr.ScAddress{
						Type:      xdr.ScAddressTypeScAddressTypeAccount,
						AccountId: &organizerAccountID,
					},
					Salt: salt,
				},
			},
			Executable: xdr.ContractExecutable{
				Type:     xdr.ContractExecutableTypeContractExecutableWasm,
				WasmHash: &hash,
			},
		},
	})
	must(err)
	contractID := mustV(scValToContractID(createResult))
	fmt.Println("  contract:", contractID)
	contractAddr := mustV(contractScAddress(contractID))

	step("initialize + fund + approve")
	_, err = invoke(ctx, rpc, horizon, organizer, invokeContractHF(contractAddr, "initialize",
		addressArg(organizer.Address()),
		addressArg(judge.Address()),
		addressArg(judge.Address()),
		addressArg(resolver.Address()),
		addressArg(tokenID),
		i128Arg(amount),
	))
	must(err)

	_, err = invoke(ctx, rpc, horizon, organizer, invokeContractHF(contractAddr, "fund"))
	must(err)

	_, err = invoke(ctx, rpc, horizon, judge, invokeContractHF(contractAddr, "approve"))
	must(err)

	step("NEG-1: organizer attempts release directly (must be rejected)")
	_, err = invoke(ctx, rpc, horizon, organizer, invokeContractHF(contractAddr, "release", addressArg(organizer.Address())))
	if err == nil {
		fmt.Println("  UNEXPECTED-PASS — organizer moved escrowed funds via a Go-built transaction. Stop and investigate.")
		os.Exit(1)
	}
	fmt.Println("  rejected as expected:", err)

	step("Judge releases to the winner (late-bound address)")
	_, err = invoke(ctx, rpc, horizon, judge, invokeContractHF(contractAddr, "release", addressArg(winner.Address())))
	must(err)

	step("NEG-2: releasing again must fail")
	_, err = invoke(ctx, rpc, horizon, judge, invokeContractHF(contractAddr, "release", addressArg(winner.Address())))
	if err == nil {
		fmt.Println("  UNEXPECTED-PASS — double release succeeded via Go. Stop and investigate.")
		os.Exit(1)
	}
	fmt.Println("  rejected as expected:", err)

	fmt.Println("\ncontract:", contractID)
	fmt.Println("token:   ", tokenID)
	fmt.Println("K02 (server-build-plan.md) spike complete — a Go-built, -signed, and -submitted transaction drove the K01 contract end to end.")
}

func fund(horizon *horizonclient.Client, label string, kp *keypair.Full) {
	_, err := horizon.Fund(kp.Address())
	must(err)
	fmt.Printf("  %s: %s\n", label, kp.Address())
}

// nativeAssetContractID returns the deterministic contract id of the native
// XLM Stellar Asset Contract on testnet (same value for everyone, same as
// `stellar contract id asset --asset native --network testnet` in K01).
func nativeAssetContractID() (string, error) {
	asset := xdr.Asset{Type: xdr.AssetTypeAssetTypeNative}
	contractID, err := asset.ContractID(networkPassphrase)
	if err != nil {
		return "", err
	}
	return strkey.Encode(strkey.VersionByteContract, contractID[:])
}

func contractScAddress(contractID string) (xdr.ScAddress, error) {
	raw, err := strkey.Decode(strkey.VersionByteContract, contractID)
	if err != nil {
		return xdr.ScAddress{}, err
	}
	var cid xdr.ContractId
	copy(cid[:], raw)
	return xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeContract, ContractId: &cid}, nil
}

// addressArg encodes a Soroban Address argument from either a G... account
// address or a C... contract address — the `token` argument to initialize
// is a contract address, everything else here is an account.
func addressArg(address string) xdr.ScVal {
	if accountID, err := xdr.AddressToAccountId(address); err == nil {
		return xdr.ScVal{
			Type:    xdr.ScValTypeScvAddress,
			Address: &xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeAccount, AccountId: &accountID},
		}
	}
	scAddr := mustV(contractScAddress(address))
	return xdr.ScVal{Type: xdr.ScValTypeScvAddress, Address: &scAddr}
}

func i128Arg(v int64) xdr.ScVal {
	return xdr.ScVal{
		Type: xdr.ScValTypeScvI128,
		I128: &xdr.Int128Parts{Hi: 0, Lo: xdr.Uint64(v)},
	}
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

// invoke builds an InvokeHostFunction operation for hf, simulates it to
// obtain the Soroban footprint/resource fee/auth entries, then signs and
// submits the resulting transaction with source as the sole signer, and
// polls until the ledger confirms success or failure. Returns the host
// function's return value (if any) as an xdr.ScVal.
func invoke(ctx context.Context, rpc *client.Client, horizon *horizonclient.Client, source *keypair.Full, hf xdr.HostFunction) (xdr.ScVal, error) {
	account, err := rpc.LoadAccount(ctx, source.Address())
	if err != nil {
		return xdr.ScVal{}, err
	}

	unsignedOp := &txnbuild.InvokeHostFunction{HostFunction: hf, SourceAccount: source.Address()}
	unsignedTx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{unsignedOp},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(60)},
	})
	if err != nil {
		return xdr.ScVal{}, err
	}
	unsignedB64, err := unsignedTx.Base64()
	if err != nil {
		return xdr.ScVal{}, err
	}

	simResp, err := rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: unsignedB64})
	if err != nil {
		return xdr.ScVal{}, err
	}
	if simResp.Error != "" {
		return xdr.ScVal{}, fmt.Errorf("simulation failed: %s", simResp.Error)
	}

	var sorobanData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(simResp.TransactionDataXDR, &sorobanData); err != nil {
		return xdr.ScVal{}, err
	}
	sorobanData.ResourceFee = xdr.Int64(simResp.MinResourceFee)

	var auth []xdr.SorobanAuthorizationEntry
	var returnVal xdr.ScVal
	if len(simResp.Results) > 0 {
		res := simResp.Results[0]
		if res.AuthXDR != nil {
			for _, a := range *res.AuthXDR {
				var entry xdr.SorobanAuthorizationEntry
				if err := xdr.SafeUnmarshalBase64(a, &entry); err != nil {
					return xdr.ScVal{}, err
				}
				auth = append(auth, entry)
			}
		}
		if res.ReturnValueXDR != nil {
			if err := xdr.SafeUnmarshalBase64(*res.ReturnValueXDR, &returnVal); err != nil {
				return xdr.ScVal{}, err
			}
		}
	}

	// Re-load the account for a fresh sequence number and rebuild with the
	// simulated footprint/fee/auth now attached.
	account2, err := rpc.LoadAccount(ctx, source.Address())
	if err != nil {
		return xdr.ScVal{}, err
	}
	finalOp := &txnbuild.InvokeHostFunction{
		HostFunction:  hf,
		Auth:          auth,
		SourceAccount: source.Address(),
		Ext:           xdr.TransactionExt{V: 1, SorobanData: &sorobanData},
	}
	finalTx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account2,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{finalOp},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(60)},
	})
	if err != nil {
		return xdr.ScVal{}, err
	}
	finalTx, err = finalTx.Sign(networkPassphrase, source)
	if err != nil {
		return xdr.ScVal{}, err
	}
	finalB64, err := finalTx.Base64()
	if err != nil {
		return xdr.ScVal{}, err
	}

	sendResp, err := rpc.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: finalB64})
	if err != nil {
		return xdr.ScVal{}, err
	}
	if sendResp.Status == "ERROR" {
		return xdr.ScVal{}, fmt.Errorf("submission rejected: %s", sendResp.ErrorResultXDR)
	}

	for i := 0; i < 20; i++ {
		time.Sleep(1 * time.Second)
		getResp, err := rpc.GetTransaction(ctx, protocol.GetTransactionRequest{Hash: sendResp.Hash})
		if err != nil {
			return xdr.ScVal{}, err
		}
		switch getResp.Status {
		case protocol.TransactionStatusSuccess:
			return returnVal, nil
		case protocol.TransactionStatusFailed:
			return xdr.ScVal{}, fmt.Errorf("transaction failed on-chain (hash %s): %s", sendResp.Hash, getResp.ResultXDR)
		}
	}
	return xdr.ScVal{}, fmt.Errorf("timed out waiting for transaction %s to confirm", sendResp.Hash)
}

func scValToContractID(v xdr.ScVal) (string, error) {
	addr, ok := v.GetAddress()
	if !ok || addr.ContractId == nil {
		return "", fmt.Errorf("expected a contract address return value, got %+v", v)
	}
	return strkey.Encode(strkey.VersionByteContract, addr.ContractId[:])
}
