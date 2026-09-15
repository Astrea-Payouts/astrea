package api

import (
	"fmt"

	"github.com/stellar/go/xdr"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
)

// verifySignedEnvelope is every /submit endpoint's shared guard (#185
// decision 3, reused rather than reimplemented for #11 PR 1's
// deposit/create submits): it decodes signedXDR, requires a V1 single-op
// InvokeHostFunction envelope with at least one signature and a source
// account matching wantSourceAccount, and requires its host function to
// marshal to exactly wantHostFunctionXDR -- the bytes the matching /build
// step persisted. Any failure here means the signed transaction a wallet
// returned is not the one /build asked it to sign, and the caller must map
// it to 409 envelope_mismatch -- never call the RPC on it.
func verifySignedEnvelope(signedXDR, wantSourceAccount, wantHostFunctionXDR string) error {
	envelope, op, err := escrow.DecodeSingleOpInvokeHostFunction(signedXDR)
	if err != nil {
		return err
	}
	if envelope.V1 == nil || len(envelope.V1.Signatures) < 1 {
		return fmt.Errorf("escrow: signed envelope has no signatures")
	}
	source, err := envelope.V1.Tx.SourceAccount.GetAddress()
	if err != nil {
		return fmt.Errorf("escrow: reading envelope source account: %w", err)
	}
	if source != wantSourceAccount {
		return fmt.Errorf("escrow: envelope source account %s does not match the wallet that built this operation", source)
	}
	gotHostFunctionXDR, err := xdr.MarshalBase64(op.HostFunction)
	if err != nil {
		return fmt.Errorf("escrow: marshaling signed host function: %w", err)
	}
	if gotHostFunctionXDR != wantHostFunctionXDR {
		return fmt.Errorf("escrow: signed host function does not match the one /build produced")
	}
	return nil
}
