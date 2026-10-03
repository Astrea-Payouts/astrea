package trustline

import (
	"context"
	"errors"
	"strings"
	"testing"
)

const (
	usdcIssuer  = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
	otherIssuer = "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5WBFW3JJWQ2BRQ6KDD"
)

var usdc = Asset{Code: "USDC", Issuer: usdcIssuer}

func addr(c string) string { return "G" + strings.Repeat(c, 55) }

// fakeSource returns canned data per address and counts calls.
type fakeSource struct {
	accounts map[string][]Balance
	errs     map[string]error
	calls    int
}

func (f *fakeSource) Balances(_ context.Context, address string) ([]Balance, error) {
	f.calls++
	if err, ok := f.errs[address]; ok {
		return nil, err
	}
	b, ok := f.accounts[address]
	if !ok {
		return nil, ErrAccountNotFound
	}
	return b, nil
}

func newV(t *testing.T, src AccountSource) *Verifier {
	t.Helper()
	v, err := NewVerifier(src, usdc)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func TestVerifyClassification(t *testing.T) {
	boom := errors.New("horizon 503")
	tests := []struct {
		name    string
		src     *fakeSource
		want    Status
		wantErr error
	}{
		{"no account on ledger", &fakeSource{}, StatusNoAccount, nil},
		{"account without trustline", &fakeSource{accounts: map[string][]Balance{
			addr("A"): {{Native: true}},
		}}, StatusNoTrustline, nil},
		{"account with trustline", &fakeSource{accounts: map[string][]Balance{
			addr("A"): {{Native: true}, {Code: "USDC", Issuer: usdcIssuer}},
		}}, StatusOK, nil},
		{"same code, different issuer", &fakeSource{accounts: map[string][]Balance{
			addr("A"): {{Native: true}, {Code: "USDC", Issuer: otherIssuer}},
		}}, StatusNoTrustline, nil},
		{"same issuer, different code", &fakeSource{accounts: map[string][]Balance{
			addr("A"): {{Code: "EURC", Issuer: usdcIssuer}},
		}}, StatusNoTrustline, nil},
		{"horizon failure is an error, not a classification", &fakeSource{
			errs: map[string]error{addr("A"): boom},
		}, StatusUnknown, boom},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := newV(t, tt.src).Verify(context.Background(), addr("A"))
			if got != tt.want {
				t.Errorf("status = %v, want %v", got, tt.want)
			}
			if tt.wantErr == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("err = %v, want it to wrap %v", err, tt.wantErr)
				}
				if errors.Is(err, ErrNoTrustline) || errors.Is(err, ErrAccountNotFound) {
					t.Fatalf("outage must not read as a trustline/account result: %v", err)
				}
			}
		})
	}
}

func TestVerifyInvalidAddressSkipsSource(t *testing.T) {
	for _, bad := range []string{
		"", "nope", "G123",
		"M" + strings.Repeat("A", 55), // muxed shape
		"C" + strings.Repeat("A", 55), // contract address
		"G" + strings.Repeat("a", 55), // lowercase
		"G" + strings.Repeat("1", 55), // 1 is not base32
		addr("A") + "A",               // too long
	} {
		src := &fakeSource{}
		st, err := newV(t, src).Verify(context.Background(), bad)
		if !errors.Is(err, ErrInvalidAddress) || st != StatusUnknown {
			t.Errorf("%q: got (%v, %v), want (unknown, ErrInvalidAddress)", bad, st, err)
		}
		if src.calls != 0 {
			t.Errorf("%q: source was called for an invalid address", bad)
		}
	}
}

func TestZeroStatusFailsClosed(t *testing.T) {
	var s Status
	if s.HasTrustline() {
		t.Fatal("zero Status must not report a trustline")
	}
}

func TestStatusString(t *testing.T) {
	for s, want := range map[Status]string{
		StatusOK: "ok", StatusNoAccount: "no_account",
		StatusNoTrustline: "no_trustline", StatusUnknown: "unknown",
	} {
		if s.String() != want {
			t.Errorf("%d.String() = %q, want %q", s, s.String(), want)
		}
	}
}

func TestVerifyAllDedupesAndKeepsOrder(t *testing.T) {
	src := &fakeSource{accounts: map[string][]Balance{
		addr("A"): {{Code: "USDC", Issuer: usdcIssuer}},
		addr("B"): {{Native: true}},
	}}
	got, err := newV(t, src).VerifyAll(context.Background(),
		[]string{addr("B"), addr("A"), addr("B"), addr("C")})
	if err != nil {
		t.Fatal(err)
	}
	want := []Result{
		{addr("B"), StatusNoTrustline},
		{addr("A"), StatusOK},
		{addr("C"), StatusNoAccount},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d results, want %d: %+v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("result[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}
	if src.calls != 3 {
		t.Errorf("source calls = %d, want 3 (duplicates checked once)", src.calls)
	}
}

func TestRequire(t *testing.T) {
	src := &fakeSource{accounts: map[string][]Balance{
		addr("A"): {{Code: "USDC", Issuer: usdcIssuer}},
		addr("B"): {{Native: true}},
	}}
	v := newV(t, src)

	if err := v.Require(context.Background(), addr("A")); err != nil {
		t.Fatalf("all ok: unexpected error %v", err)
	}

	// Present at registration, gone at winner assignment: must block, and
	// must name every affected wallet (B has no trustline, C has no account).
	err := v.Require(context.Background(), addr("A"), addr("B"), addr("C"))
	if !errors.Is(err, ErrNoTrustline) {
		t.Fatalf("err = %v, want ErrNoTrustline", err)
	}
	var me *MissingError
	if !errors.As(err, &me) {
		t.Fatalf("err is not *MissingError: %T", err)
	}
	if me.Asset != usdc || len(me.Wallets) != 2 ||
		me.Wallets[0] != (Result{addr("B"), StatusNoTrustline}) ||
		me.Wallets[1] != (Result{addr("C"), StatusNoAccount}) {
		t.Fatalf("unexpected MissingError: %+v", me)
	}
	if !strings.Contains(err.Error(), usdc.String()) {
		t.Errorf("message should name the asset: %v", err)
	}
}

func TestRequireLookupFailureIsNotMissing(t *testing.T) {
	boom := errors.New("timeout")
	src := &fakeSource{errs: map[string]error{addr("A"): boom}}
	err := newV(t, src).Require(context.Background(), addr("A"))
	if !errors.Is(err, boom) || errors.Is(err, ErrNoTrustline) {
		t.Fatalf("err = %v, want wrapped timeout and not ErrNoTrustline", err)
	}
}

func TestNewVerifierValidation(t *testing.T) {
	if _, err := NewVerifier(nil, usdc); err == nil {
		t.Error("nil source should be rejected")
	}
	if _, err := NewVerifier(&fakeSource{}, Asset{Code: "USDC"}); err == nil {
		t.Error("missing issuer should be rejected")
	}
	if _, err := NewVerifier(&fakeSource{}, Asset{Issuer: usdcIssuer}); err == nil {
		t.Error("missing code should be rejected")
	}
}
