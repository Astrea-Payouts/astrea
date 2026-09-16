package escrow

import (
	"fmt"

	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
)

// ClassicAssetContractID derives the Stellar Asset Contract (SAC) address
// for a classic asset (code:issuer) on networkPassphrase -- the same
// C-address `stellar contract id asset --asset CODE:ISSUER --network ...`
// prints, via the identical xdr.Asset.ContractID path the stellar-cli
// itself uses. Moved here from cmd/escrow-testnet-proof's resolveToken
// (issue #11) so internal/config can validate USDC_ISSUER at boot and
// internal/api's organizer-path handlers derive the exact same address,
// rather than each keeping its own copy of this logic.
func ClassicAssetContractID(code, issuer, networkPassphrase string) (string, error) {
	classic := txnbuild.CreditAsset{Code: code, Issuer: issuer}
	xdrAsset, err := classic.ToXDR()
	if err != nil {
		return "", fmt.Errorf("building classic asset %s:%s: %w", code, issuer, err)
	}
	id, err := xdrAsset.ContractID(networkPassphrase)
	if err != nil {
		return "", fmt.Errorf("deriving %s SAC contract id: %w", code, err)
	}
	contractID, err := strkey.Encode(strkey.VersionByteContract, id[:])
	if err != nil {
		return "", fmt.Errorf("encoding %s SAC contract id: %w", code, err)
	}
	return contractID, nil
}
