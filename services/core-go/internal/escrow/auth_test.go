package escrow

import (
	"bytes"
	"context"
	"crypto/sha256"
	"testing"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

// testInvocation returns a minimal, well-formed SorobanAuthorizedInvocation
// (a get_balance call) -- every SorobanAuthorizationEntry needs one to
// marshal at all, including SOURCE_ACCOUNT entries used here purely to
// exercise PendingAuth filtering, not authPreimageHash.
func testInvocation(t *testing.T) xdr.SorobanAuthorizedInvocation {
	t.Helper()
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	return xdr.SorobanAuthorizedInvocation{
		Function: xdr.SorobanAuthorizedFunction{
			Type: xdr.SorobanAuthorizedFunctionTypeSorobanAuthorizedFunctionTypeContractFn,
			ContractFn: &xdr.InvokeContractArgs{
				ContractAddress: contract,
				FunctionName:    xdr.ScSymbol("get_balance"),
				Args:            []xdr.ScVal{},
			},
		},
	}
}

// testAuthAddressCredentials builds a SOROBAN_CREDENTIALS_ADDRESS entry for
// signer, with a fixed nonce/expiration and a resolve_dispute invocation --
// used by every test below as the "pending" entry a resolver's wallet would
// be asked to sign.
func testAuthAddressCredentials(t *testing.T, signerAddress string, nonce int64, expirationLedger uint32) xdr.SorobanAuthorizationEntry {
	t.Helper()
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	accountID, err := xdr.AddressToAccountId(signerAddress)
	if err != nil {
		t.Fatalf("AddressToAccountId(%q): %v", signerAddress, err)
	}
	return xdr.SorobanAuthorizationEntry{
		Credentials: xdr.SorobanCredentials{
			Type: xdr.SorobanCredentialsTypeSorobanCredentialsAddress,
			Address: &xdr.SorobanAddressCredentials{
				Address:                   xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeAccount, AccountId: &accountID},
				Nonce:                     xdr.Int64(nonce),
				SignatureExpirationLedger: xdr.Uint32(expirationLedger),
				Signature:                 xdr.ScVal{Type: xdr.ScValTypeScvVoid},
			},
		},
		RootInvocation: xdr.SorobanAuthorizedInvocation{
			Function: xdr.SorobanAuthorizedFunction{
				Type: xdr.SorobanAuthorizedFunctionTypeSorobanAuthorizedFunctionTypeContractFn,
				ContractFn: &xdr.InvokeContractArgs{
					ContractAddress: contract,
					FunctionName:    xdr.ScSymbol("resolve_dispute"),
					Args:            []xdr.ScVal{scU32(1)},
				},
			},
		},
	}
}

// --- authPreimageHash: fixed vector ---------------------------------------

// TestAuthPreimageHash_FixedVector pins the exact bytes the Soroban host
// hashes and expects a signature over: the SHA-256 digest of a
// HashIdPreimage{type: ENVELOPE_TYPE_SOROBAN_AUTHORIZATION, networkID, nonce,
// signatureExpirationLedger, invocation} (see soroban-env-host's
// auth.rs:get_signature_payload for a SOROBAN_CREDENTIALS_ADDRESS entry that
// isn't AddressV2/delegated -- the only shape RPC simulation on today's
// testnet protocol ever returns). "want" is built independently of
// authPreimageHash, straight from xdr.Marshal + sha256, so a bug that swaps
// the envelope type or a field's position in the real function shows up as a
// mismatch here, not as a silent pass.
func TestAuthPreimageHash_FixedVector(t *testing.T) {
	const (
		nonce            = int64(424242)
		expirationLedger = uint32(1000)
	)
	entry := testAuthAddressCredentials(t, testWinner1Address, nonce, expirationLedger)

	networkID := network.ID(network.TestNetworkPassphrase)
	preimage := xdr.HashIdPreimage{
		Type: xdr.EnvelopeTypeEnvelopeTypeSorobanAuthorization,
		SorobanAuthorization: &xdr.HashIdPreimageSorobanAuthorization{
			NetworkId:                 xdr.Hash(networkID),
			Nonce:                     xdr.Int64(nonce),
			SignatureExpirationLedger: xdr.Uint32(expirationLedger),
			Invocation:                entry.RootInvocation,
		},
	}
	var buf bytes.Buffer
	if _, err := xdr.Marshal(&buf, &preimage); err != nil {
		t.Fatalf("marshaling expected preimage: %v", err)
	}
	want := sha256.Sum256(buf.Bytes())

	got, err := authPreimageHash(entry, network.TestNetworkPassphrase)
	if err != nil {
		t.Fatalf("authPreimageHash returned error: %v", err)
	}
	if got != want {
		t.Fatalf("authPreimageHash = %x, want %x", got, want)
	}
}

// --- SignAuthEntry ---------------------------------------------------------

func TestSignAuthEntry_ProducesValidSignature(t *testing.T) {
	signer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating signer keypair: %v", err)
	}
	entry := testAuthAddressCredentials(t, signer.Address(), 1, 500)

	signed, err := SignAuthEntry(entry, signer, network.TestNetworkPassphrase)
	if err != nil {
		t.Fatalf("SignAuthEntry returned error: %v", err)
	}

	if signed.Credentials.Address == nil {
		t.Fatal("signed entry lost its Address credentials")
	}
	sigVal := signed.Credentials.Address.Signature
	vec, ok := sigVal.GetVec()
	if !ok || vec == nil || len(*vec) != 1 {
		t.Fatalf("signature = %+v, want a 1-element ScvVec", sigVal)
	}
	m, ok := (*vec)[0].GetMap()
	if !ok || m == nil || len(*m) != 2 {
		t.Fatalf("signature[0] = %+v, want a 2-entry ScvMap", (*vec)[0])
	}
	entries := *m
	if got := string(*entries[0].Key.Sym); got != "public_key" {
		t.Fatalf("signature map key 0 = %q, want %q (sorted key order)", got, "public_key")
	}
	if got := string(*entries[1].Key.Sym); got != "signature" {
		t.Fatalf("signature map key 1 = %q, want %q (sorted key order)", got, "signature")
	}

	gotPubKey := []byte(*entries[0].Val.Bytes)
	wantPubKey, err := strkey.Decode(strkey.VersionByteAccountID, signer.Address())
	if err != nil {
		t.Fatalf("decoding signer address: %v", err)
	}
	if !bytes.Equal(gotPubKey, wantPubKey) {
		t.Fatalf("public_key = %x, want %x", gotPubKey, wantPubKey)
	}

	hash, err := authPreimageHash(entry, network.TestNetworkPassphrase)
	if err != nil {
		t.Fatalf("authPreimageHash: %v", err)
	}
	gotSig := []byte(*entries[1].Val.Bytes)
	if err := signer.Verify(hash[:], gotSig); err != nil {
		t.Fatalf("signature does not verify against the expected preimage hash: %v", err)
	}
}

func TestSignAuthEntry_RejectsSourceAccountCredentials(t *testing.T) {
	signer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating signer keypair: %v", err)
	}
	entry := xdr.SorobanAuthorizationEntry{
		Credentials: xdr.SorobanCredentials{Type: xdr.SorobanCredentialsTypeSorobanCredentialsSourceAccount},
	}

	_, err = SignAuthEntry(entry, signer, network.TestNetworkPassphrase)
	if err == nil {
		t.Fatal("expected an error signing a SOURCE_ACCOUNT credentials entry, got nil")
	}
}

// --- BuildUnsigned: PendingAuth ---------------------------------------------

// TestBuildUnsigned_SourceAccountEntryNeverPending is the regression test for
// PendingAuth's defining invariant: an auth entry authorized implicitly by
// the envelope's own signature (SOROBAN_CREDENTIALS_SOURCE_ACCOUNT) must
// never show up asking for an extra, separate signature.
func TestBuildUnsigned_SourceAccountEntryNeverPending(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	hf, err := GetBalanceHostFunction(contract, testAccountAddress)
	if err != nil {
		t.Fatalf("GetBalanceHostFunction: %v", err)
	}

	rpc := happyMockRPCWithAuth(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid}, []xdr.SorobanAuthorizationEntry{
		{
			Credentials:    xdr.SorobanCredentials{Type: xdr.SorobanCredentialsTypeSorobanCredentialsSourceAccount},
			RootInvocation: testInvocation(t),
		},
	})

	unsigned, err := BuildUnsigned(context.Background(), rpc, testAccountAddress, hf, Config{})
	if err != nil {
		t.Fatalf("BuildUnsigned returned error: %v", err)
	}
	if len(unsigned.PendingAuth) != 0 {
		t.Fatalf("PendingAuth = %+v, want empty for a SOURCE_ACCOUNT-only auth list", unsigned.PendingAuth)
	}
}

// TestBuildUnsigned_AddressEntryIsPending proves the flip side: an Address
// credentials entry does surface in PendingAuth, with a
// SignatureExpirationLedger stamped in from the simulation's LatestLedger.
func TestBuildUnsigned_AddressEntryIsPending(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	hf, err := GetBalanceHostFunction(contract, testAccountAddress)
	if err != nil {
		t.Fatalf("GetBalanceHostFunction: %v", err)
	}
	pending := testAuthAddressCredentials(t, testWinner1Address, 7, 0)

	rpc := happyMockRPCWithAuth(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid}, []xdr.SorobanAuthorizationEntry{pending})
	rpc.simulateFn = wrapSimulateWithLatestLedger(rpc.simulateFn, 12345)

	unsigned, err := BuildUnsigned(context.Background(), rpc, testAccountAddress, hf, Config{})
	if err != nil {
		t.Fatalf("BuildUnsigned returned error: %v", err)
	}
	if len(unsigned.PendingAuth) != 1 {
		t.Fatalf("PendingAuth has %d entries, want 1", len(unsigned.PendingAuth))
	}
	got := unsigned.PendingAuth[0].Credentials.Address.SignatureExpirationLedger
	want := xdr.Uint32(12345) + authExpirationLedgers
	if got != want {
		t.Fatalf("SignatureExpirationLedger = %d, want %d", got, want)
	}
}

// --- AttachSignedAuth --------------------------------------------------------

func TestAttachSignedAuth_ReplacesMatchingEntry(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	hf, err := GetBalanceHostFunction(contract, testAccountAddress)
	if err != nil {
		t.Fatalf("GetBalanceHostFunction: %v", err)
	}
	resolver, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating resolver keypair: %v", err)
	}

	sourceEntry := xdr.SorobanAuthorizationEntry{
		Credentials:    xdr.SorobanCredentials{Type: xdr.SorobanCredentialsTypeSorobanCredentialsSourceAccount},
		RootInvocation: testInvocation(t),
	}
	addressEntry := testAuthAddressCredentials(t, resolver.Address(), 99, 0)

	rpc := happyMockRPCWithAuth(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid}, []xdr.SorobanAuthorizationEntry{sourceEntry, addressEntry})

	unsigned, err := BuildUnsigned(context.Background(), rpc, testAccountAddress, hf, Config{})
	if err != nil {
		t.Fatalf("BuildUnsigned returned error: %v", err)
	}
	if len(unsigned.PendingAuth) != 1 {
		t.Fatalf("PendingAuth has %d entries, want 1", len(unsigned.PendingAuth))
	}

	signed, err := SignAuthEntry(unsigned.PendingAuth[0], resolver, network.TestNetworkPassphrase)
	if err != nil {
		t.Fatalf("SignAuthEntry returned error: %v", err)
	}

	attached, err := AttachSignedAuth(unsigned, []xdr.SorobanAuthorizationEntry{signed})
	if err != nil {
		t.Fatalf("AttachSignedAuth returned error: %v", err)
	}
	if len(attached.PendingAuth) != 0 {
		t.Fatalf("attached.PendingAuth has %d entries, want 0", len(attached.PendingAuth))
	}

	generic, err := txnbuild.TransactionFromXDR(attached.XDR)
	if err != nil {
		t.Fatalf("parsing attached envelope: %v", err)
	}
	tx, ok := generic.Transaction()
	if !ok {
		t.Fatal("attached envelope is not a simple transaction")
	}
	envelope := tx.ToXDR()
	op := envelope.V1.Tx.Operations[0].Body.InvokeHostFunctionOp
	if op == nil || len(op.Auth) != 2 {
		t.Fatalf("expected 2 auth entries in the attached transaction, got %+v", op)
	}
	foundSigned := false
	for _, e := range op.Auth {
		if e.Credentials.Type == xdr.SorobanCredentialsTypeSorobanCredentialsAddress {
			if e.Credentials.Address.Signature.Type == xdr.ScValTypeScvVoid {
				t.Fatal("address credentials entry in the attached transaction still has an empty signature")
			}
			foundSigned = true
		}
	}
	if !foundSigned {
		t.Fatal("no address credentials entry found in the attached transaction")
	}
}

func TestAttachSignedAuth_RejectsNonMatchingEntry(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	hf, err := GetBalanceHostFunction(contract, testAccountAddress)
	if err != nil {
		t.Fatalf("GetBalanceHostFunction: %v", err)
	}
	resolver, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating resolver keypair: %v", err)
	}
	addressEntry := testAuthAddressCredentials(t, resolver.Address(), 99, 0)
	rpc := happyMockRPCWithAuth(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid}, []xdr.SorobanAuthorizationEntry{addressEntry})

	unsigned, err := BuildUnsigned(context.Background(), rpc, testAccountAddress, hf, Config{})
	if err != nil {
		t.Fatalf("BuildUnsigned returned error: %v", err)
	}

	unrelated := testAuthAddressCredentials(t, resolver.Address(), 555, 0)
	signedUnrelated, err := SignAuthEntry(unrelated, resolver, network.TestNetworkPassphrase)
	if err != nil {
		t.Fatalf("SignAuthEntry: %v", err)
	}

	_, err = AttachSignedAuth(unsigned, []xdr.SorobanAuthorizationEntry{signedUnrelated})
	if err == nil {
		t.Fatal("expected an error attaching a signed entry that matches no pending entry, got nil")
	}
}
