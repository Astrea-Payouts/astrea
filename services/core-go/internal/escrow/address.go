package escrow

import (
	"fmt"

	"github.com/stellar/go/strkey"
	"github.com/stellar/go/xdr"
)

// AddressArg encodes a Soroban Address ScVal from either a G-prefixed
// account strkey or a C-prefixed contract strkey.
//
// K02's original bug was assuming every Address argument was a G-account;
// the token argument to initialize is a C-contract. Callers must go through
// this helper rather than hand-rolling AddressToAccountId.
func AddressArg(address string) (xdr.ScVal, error) {
	if address == "" {
		return xdr.ScVal{}, fmt.Errorf("empty stellar address")
	}

	if accountID, err := xdr.AddressToAccountId(address); err == nil {
		return xdr.ScVal{
			Type: xdr.ScValTypeScvAddress,
			Address: &xdr.ScAddress{
				Type:      xdr.ScAddressTypeScAddressTypeAccount,
				AccountId: &accountID,
			},
		}, nil
	}

	raw, err := strkey.Decode(strkey.VersionByteContract, address)
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("not a G-account or C-contract address %q: %w", address, err)
	}
	var cid xdr.ContractId
	copy(cid[:], raw)
	return xdr.ScVal{
		Type: xdr.ScValTypeScvAddress,
		Address: &xdr.ScAddress{
			Type:       xdr.ScAddressTypeScAddressTypeContract,
			ContractId: &cid,
		},
	}, nil
}
