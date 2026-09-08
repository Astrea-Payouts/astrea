// Package escrow provides the shared Soroban transaction pipeline used by
// every EscrowClient operation, plus the argument-encoding helpers those
// operations build on top of.
package escrow

import (
	"fmt"

	"github.com/stellar/go/strkey"
	"github.com/stellar/go/xdr"
)

// EncodeAddress builds a Soroban ScVal Address argument from a Stellar
// strkey. Soroban's Address type is polymorphic over Stellar accounts
// (G...) and contracts (C...); a caller building a contract-invocation
// argument list generally does not know in advance which kind a given
// address string is (e.g. K01/K02's `token` argument to `initialize` is a
// contract address while every other address argument there is an
// account), so this tries the account encoding first and falls back to the
// contract encoding rather than assuming one or the other.
func EncodeAddress(address string) (xdr.ScVal, error) {
	if accountID, err := xdr.AddressToAccountId(address); err == nil {
		return xdr.ScVal{
			Type:    xdr.ScValTypeScvAddress,
			Address: &xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeAccount, AccountId: &accountID},
		}, nil
	}

	scAddr, err := ContractAddress(address)
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("escrow: %q is neither a valid G-address (account) nor a valid C-address (contract): %w", address, err)
	}
	return xdr.ScVal{Type: xdr.ScValTypeScvAddress, Address: &scAddr}, nil
}

// ContractAddress decodes a C... contract strkey into an xdr.ScAddress.
func ContractAddress(contractID string) (xdr.ScAddress, error) {
	raw, err := strkey.Decode(strkey.VersionByteContract, contractID)
	if err != nil {
		return xdr.ScAddress{}, fmt.Errorf("escrow: decoding contract address %q: %w", contractID, err)
	}
	var cid xdr.ContractId
	copy(cid[:], raw)
	return xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeContract, ContractId: &cid}, nil
}
