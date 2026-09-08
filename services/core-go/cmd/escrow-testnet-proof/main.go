// Command escrow-testnet-proof is a manual, network-touching harness that
// proves internal/escrow.Submit against the real, already-deployed
// event-escrow contract on Stellar testnet (see
// smart-contracts/astrea/contracts/event-escrow/README.md for that
// deployment's own proof). It calls deposit_funds(admin, token, amount) -
// one call exercising a G-address (admin), a C-address (token, the native
// XLM SAC) and an i128 (amount) - then get_balance(admin) to confirm the
// state change, both through the shared pipeline.
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

	token, err := nativeAssetContractID()
	if err != nil {
		log.Fatalf("deriving native XLM SAC contract id: %v", err)
	}
	fmt.Println("token:", token)

	contractAddr, err := escrow.ContractAddress(contractID)
	if err != nil {
		log.Fatalf("decoding event-escrow contract address: %v", err)
	}
	adminArg, err := escrow.EncodeAddress(admin.Address())
	if err != nil {
		log.Fatalf("encoding admin G-address: %v", err)
	}
	tokenArg, err := escrow.EncodeAddress(token)
	if err != nil {
		log.Fatalf("encoding token C-address: %v", err)
	}

	fmt.Println("\n[1/2] deposit_funds(admin, token, amount)")
	depositResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase,
		invokeContractHF(contractAddr, "deposit_funds", adminArg, tokenArg, i128Arg(depositAmount)),
		escrow.Config{},
	)
	if err != nil {
		log.Fatalf("deposit_funds failed: %v", err)
	}
	fmt.Println("  tx hash:", depositResult.Hash)

	fmt.Println("\n[2/2] get_balance(admin)")
	balanceResult, err := escrow.Submit(ctx, rpc, admin, network.TestNetworkPassphrase,
		invokeContractHF(contractAddr, "get_balance", adminArg),
		escrow.Config{},
	)
	if err != nil {
		log.Fatalf("get_balance failed: %v", err)
	}
	fmt.Println("  tx hash:", balanceResult.Hash)

	balance, ok := balanceResult.ReturnValue.GetI128()
	if !ok {
		log.Fatalf("get_balance did not return an i128, got %+v", balanceResult.ReturnValue)
	}
	fmt.Printf("  balance: %d stroops (want %d)\n", int64(balance.Lo), depositAmount)
	if balance.Hi != 0 || int64(balance.Lo) != depositAmount {
		log.Fatalf("balance mismatch: got hi=%d lo=%d, want %d", balance.Hi, balance.Lo, depositAmount)
	}

	fmt.Println("\nE01a testnet round-trip complete: deposit_funds + get_balance, both through internal/escrow.Submit.")
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

func i128Arg(v int64) xdr.ScVal {
	return xdr.ScVal{
		Type: xdr.ScValTypeScvI128,
		I128: &xdr.Int128Parts{Hi: 0, Lo: xdr.Uint64(v)},
	}
}
