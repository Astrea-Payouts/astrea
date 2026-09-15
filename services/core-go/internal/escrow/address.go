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

// DecodeAddressToString is EncodeAddress's inverse: given an ScVal a
// contract call returned (e.g. get_default_resolver's Address), it produces
// the G... or C... strkey a caller would recognize, whichever kind the
// value actually holds.
func DecodeAddressToString(sv xdr.ScVal) (string, error) {
	if sv.Type != xdr.ScValTypeScvAddress || sv.Address == nil {
		return "", fmt.Errorf("escrow: expected an Address value, got %v", sv.Type)
	}
	switch sv.Address.Type {
	case xdr.ScAddressTypeScAddressTypeAccount:
		if sv.Address.AccountId == nil {
			return "", fmt.Errorf("escrow: address value has no account id")
		}
		return sv.Address.AccountId.Address(), nil
	case xdr.ScAddressTypeScAddressTypeContract:
		if sv.Address.ContractId == nil {
			return "", fmt.Errorf("escrow: address value has no contract id")
		}
		return strkey.Encode(strkey.VersionByteContract, sv.Address.ContractId[:])
	default:
		return "", fmt.Errorf("escrow: unsupported address type %v", sv.Address.Type)
	}
}
