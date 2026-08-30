package escrow

import (
	"testing"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/xdr"
)

func TestAddressArgAccount(t *testing.T) {
	t.Parallel()
	kp, err := keypair.Random()
	if err != nil {
		t.Fatal(err)
	}
	val, err := AddressArg(kp.Address())
	if err != nil {
		t.Fatalf("G-address: %v", err)
	}
	if val.Type != xdr.ScValTypeScvAddress {
		t.Fatalf("type = %v, want Address", val.Type)
	}
	addr := val.MustAddress()
	if addr.Type != xdr.ScAddressTypeScAddressTypeAccount {
		t.Fatalf("encoded as %v, want account (K02 regression: G-address must stay G)", addr.Type)
	}
	if addr.AccountId == nil {
		t.Fatal("missing AccountId")
	}
	got := addr.AccountId.Address()
	if got != kp.Address() {
		t.Fatalf("round-trip %s, want %s", got, kp.Address())
	}
}

func TestAddressArgContract(t *testing.T) {
	t.Parallel()
	raw := make([]byte, 32)
	for i := range raw {
		raw[i] = byte(i + 1)
	}
	cid, err := strkey.Encode(strkey.VersionByteContract, raw)
	if err != nil {
		t.Fatal(err)
	}
	val, err := AddressArg(cid)
	if err != nil {
		t.Fatalf("C-address: %v", err)
	}
	addr := val.MustAddress()
	if addr.Type != xdr.ScAddressTypeScAddressTypeContract {
		t.Fatalf("encoded as %v, want contract (K02 bug: token C-address was treated as G-account)", addr.Type)
	}
	if addr.ContractId == nil {
		t.Fatal("missing ContractId")
	}
	got, err := strkey.Encode(strkey.VersionByteContract, addr.ContractId[:])
	if err != nil {
		t.Fatal(err)
	}
	if got != cid {
		t.Fatalf("round-trip %s, want %s", got, cid)
	}
}

func TestAddressArgRejectsInvalid(t *testing.T) {
	t.Parallel()
	for _, in := range []string{"", "not-an-address", "GABC", "CABC"} {
		if _, err := AddressArg(in); err == nil {
			t.Fatalf("expected error for %q", in)
		}
	}
}
