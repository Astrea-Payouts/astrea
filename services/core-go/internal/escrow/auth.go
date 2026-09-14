// auth.go implements the two-signature build path emergency_withdraw needs:
// signing a SOROBAN_CREDENTIALS_ADDRESS auth entry that belongs to someone
// other than the transaction's source account, and folding that signature
// back into an UnsignedTx's envelope before it can be submitted.
//
// BuildUnsigned (pipeline.go) already does the right thing when every auth
// entry simulation returns is SOROBAN_CREDENTIALS_SOURCE_ACCOUNT: the
// envelope's own signature implicitly satisfies those. It is not enough when
// an entry is SOROBAN_CREDENTIALS_ADDRESS for some other party -- that entry
// needs its own signature, computed over the exact bytes the Soroban host
// verifies: sha256 of a HashIdPreimage{type: ENVELOPE_TYPE_SOROBAN_AUTHORIZATION,
// networkId, nonce, signatureExpirationLedger, invocation} (see
// soroban-env-host's auth.rs:get_signature_payload -- the AddressV2/delegated
// preimage variant it also supports does not apply here: RPC simulation on
// today's testnet protocol only ever returns plain SOROBAN_CREDENTIALS_ADDRESS
// entries), signed with the party's own key and wrapped in the same
// {public_key, signature} shape the built-in account contract's __check_auth
// expects (soroban-env-host's account_contract.rs: AccountEd25519Signature,
// a #[contracttype] struct -- so {public_key, signature} sorted key order,
// same convention as Winner/Participants in lifecycle.go).
package escrow

import (
	"bytes"
	"crypto/sha256"
	"fmt"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/xdr"
)

// SignAuthEntry computes the signature payload for entry (a
// SOROBAN_CREDENTIALS_ADDRESS entry from an UnsignedTx.PendingAuth list) and
// signs it with signer, returning a copy of entry with its Signature filled
// in. It never touches entry.Credentials.Address.Nonce or
// SignatureExpirationLedger -- those must already match what the built
// transaction's Auth list carries, which is exactly what BuildUnsigned's
// PendingAuth entries do.
//
// In production this is the resolver's own wallet's job, done client-side
// with a key this service never sees (README, S04); this function exists so
// the testnet harness (and any test) can produce the exact bytes a real
// wallet must produce.
func SignAuthEntry(entry xdr.SorobanAuthorizationEntry, signer *keypair.Full, networkPassphrase string) (xdr.SorobanAuthorizationEntry, error) {
	if entry.Credentials.Type != xdr.SorobanCredentialsTypeSorobanCredentialsAddress || entry.Credentials.Address == nil {
		return xdr.SorobanAuthorizationEntry{}, fmt.Errorf("escrow: SignAuthEntry requires a SOROBAN_CREDENTIALS_ADDRESS entry, got %v", entry.Credentials.Type)
	}

	hash, err := authPreimageHash(entry, networkPassphrase)
	if err != nil {
		return xdr.SorobanAuthorizationEntry{}, err
	}

	sig, err := signer.Sign(hash[:])
	if err != nil {
		return xdr.SorobanAuthorizationEntry{}, fmt.Errorf("escrow: signing auth entry: %w", err)
	}

	publicKey, err := strkey.Decode(strkey.VersionByteAccountID, signer.Address())
	if err != nil {
		return xdr.SorobanAuthorizationEntry{}, fmt.Errorf("escrow: decoding signer address: %w", err)
	}

	sigVal, err := accountEd25519SignatureScVal(publicKey, sig)
	if err != nil {
		return xdr.SorobanAuthorizationEntry{}, err
	}

	signed := entry
	addrCreds := *entry.Credentials.Address
	addrCreds.Signature = sigVal
	signed.Credentials.Address = &addrCreds
	return signed, nil
}

// authPreimageHash computes the sha256 digest of the HashIdPreimage the
// Soroban host requires a SOROBAN_CREDENTIALS_ADDRESS entry's signature to
// cover -- see this file's top-of-file comment for the exact shape and the
// host source backing it.
func authPreimageHash(entry xdr.SorobanAuthorizationEntry, networkPassphrase string) ([32]byte, error) {
	if entry.Credentials.Type != xdr.SorobanCredentialsTypeSorobanCredentialsAddress || entry.Credentials.Address == nil {
		return [32]byte{}, fmt.Errorf("escrow: authPreimageHash requires a SOROBAN_CREDENTIALS_ADDRESS entry, got %v", entry.Credentials.Type)
	}
	creds := entry.Credentials.Address
	networkID := network.ID(networkPassphrase)

	preimage := xdr.HashIdPreimage{
		Type: xdr.EnvelopeTypeEnvelopeTypeSorobanAuthorization,
		SorobanAuthorization: &xdr.HashIdPreimageSorobanAuthorization{
			NetworkId:                 xdr.Hash(networkID),
			Nonce:                     creds.Nonce,
			SignatureExpirationLedger: creds.SignatureExpirationLedger,
			Invocation:                entry.RootInvocation,
		},
	}

	var buf bytes.Buffer
	if _, err := xdr.Marshal(&buf, &preimage); err != nil {
		return [32]byte{}, fmt.Errorf("escrow: marshaling auth preimage: %w", err)
	}
	return sha256.Sum256(buf.Bytes()), nil
}

// accountEd25519SignatureScVal encodes {publicKey, signature} as the Vec of
// one AccountEd25519Signature map the built-in account contract's
// __check_auth expects for a G-account signer: a single-element ScvVec
// holding an ScvMap with sorted keys {public_key, signature} (already
// alphabetical, same convention as Winner/Participants in lifecycle.go).
func accountEd25519SignatureScVal(publicKey, signature []byte) (xdr.ScVal, error) {
	if len(publicKey) != 32 {
		return xdr.ScVal{}, fmt.Errorf("escrow: expected a 32-byte ed25519 public key, got %d bytes", len(publicKey))
	}
	if len(signature) != 64 {
		return xdr.ScVal{}, fmt.Errorf("escrow: expected a 64-byte ed25519 signature, got %d bytes", len(signature))
	}
	pubKeyBytes := xdr.ScBytes(append([]byte(nil), publicKey...))
	sigBytes := xdr.ScBytes(append([]byte(nil), signature...))
	entry := scMap(xdr.ScMap{
		{Key: scSymbol("public_key"), Val: xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &pubKeyBytes}},
		{Key: scSymbol("signature"), Val: xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &sigBytes}},
	})
	return scVec(xdr.ScVec{entry}), nil
}

// AttachSignedAuth folds signed entries (each produced by SignAuthEntry) back
// into tx's envelope, replacing the matching pending entry -- matched on
// nonce + address, since those two together identify which required
// authorization a given signature satisfies -- and returns a new UnsignedTx
// with an empty PendingAuth. It rejects a signed entry that doesn't match any
// pending one, and errors unless every pending entry gets a match: the
// result is only ever "fully signed" or an error, never partially signed.
func AttachSignedAuth(tx UnsignedTx, signed []xdr.SorobanAuthorizationEntry) (UnsignedTx, error) {
	if len(signed) != len(tx.PendingAuth) {
		return UnsignedTx{}, fmt.Errorf("escrow: AttachSignedAuth got %d signed entries, want exactly %d (one per pending entry)", len(signed), len(tx.PendingAuth))
	}

	var envelope xdr.TransactionEnvelope
	if err := xdr.SafeUnmarshalBase64(tx.XDR, &envelope); err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: decoding unsigned envelope: %w", err)
	}
	if envelope.V1 == nil || len(envelope.V1.Tx.Operations) != 1 {
		return UnsignedTx{}, fmt.Errorf("escrow: expected a single-operation v1 transaction envelope")
	}
	op := envelope.V1.Tx.Operations[0].Body.InvokeHostFunctionOp
	if op == nil {
		return UnsignedTx{}, fmt.Errorf("escrow: expected an InvokeHostFunction operation")
	}

	matchedPending := make([]bool, len(tx.PendingAuth))
	for _, se := range signed {
		if se.Credentials.Type != xdr.SorobanCredentialsTypeSorobanCredentialsAddress || se.Credentials.Address == nil {
			return UnsignedTx{}, fmt.Errorf("escrow: AttachSignedAuth requires SOROBAN_CREDENTIALS_ADDRESS entries")
		}

		pendingIdx := -1
		for i, pending := range tx.PendingAuth {
			if !matchedPending[i] && authEntriesMatch(pending, se) {
				pendingIdx = i
				break
			}
		}
		if pendingIdx == -1 {
			return UnsignedTx{}, fmt.Errorf("escrow: signed auth entry (nonce %d) does not match any pending entry", se.Credentials.Address.Nonce)
		}
		matchedPending[pendingIdx] = true

		opIdx := -1
		for i, e := range op.Auth {
			if authEntriesMatch(e, tx.PendingAuth[pendingIdx]) {
				opIdx = i
				break
			}
		}
		if opIdx == -1 {
			return UnsignedTx{}, fmt.Errorf("escrow: internal error: pending entry (nonce %d) not present in the transaction's auth list", tx.PendingAuth[pendingIdx].Credentials.Address.Nonce)
		}
		op.Auth[opIdx] = se
	}

	xdrB64, err := xdr.MarshalBase64(envelope)
	if err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: encoding updated envelope: %w", err)
	}
	return UnsignedTx{XDR: xdrB64, SimulatedReturn: tx.SimulatedReturn, PendingAuth: nil}, nil
}

// authEntriesMatch identifies "the same required authorization" across two
// SorobanAuthorizationEntry values by nonce + address -- the pair BuildUnsigned
// and AttachSignedAuth's caller agree on, since a signature only makes sense
// once nonce and signer are both fixed.
func authEntriesMatch(a, b xdr.SorobanAuthorizationEntry) bool {
	if a.Credentials.Type != xdr.SorobanCredentialsTypeSorobanCredentialsAddress ||
		b.Credentials.Type != xdr.SorobanCredentialsTypeSorobanCredentialsAddress {
		return false
	}
	if a.Credentials.Address == nil || b.Credentials.Address == nil {
		return false
	}
	if a.Credentials.Address.Nonce != b.Credentials.Address.Nonce {
		return false
	}
	return a.Credentials.Address.Address.Equals(b.Credentials.Address.Address)
}
