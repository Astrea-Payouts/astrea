package trustline

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stellar/go/clients/horizonclient"
)

// These tests drive the real horizonclient against an httptest server, so the
// 404 -> ErrAccountNotFound mapping is checked against the SDK's actual error
// type rather than a hand-built one.
func newHorizonTestVerifier(t *testing.T, h http.HandlerFunc) *Verifier {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	client := &horizonclient.Client{
		HorizonURL: srv.URL,
		HTTP:       &http.Client{Timeout: 5 * time.Second},
	}
	v, err := NewVerifier(HorizonSource{Client: client}, usdc)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func TestHorizonSource404IsNoAccount(t *testing.T) {
	v := newHorizonTestVerifier(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"type":"https://stellar.org/horizon-errors/not_found","title":"Resource Missing","status":404,"detail":"The resource at the url requested was not found."}`))
	})
	st, err := v.Verify(context.Background(), addr("A"))
	if err != nil || st != StatusNoAccount {
		t.Fatalf("got (%v, %v), want (no_account, nil)", st, err)
	}
}

func TestHorizonSource500IsError(t *testing.T) {
	v := newHorizonTestVerifier(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"type":"https://stellar.org/horizon-errors/timeout","title":"Timeout","status":503}`))
	})
	st, err := v.Verify(context.Background(), addr("A"))
	if err == nil || st != StatusUnknown || errors.Is(err, ErrNoTrustline) {
		t.Fatalf("got (%v, %v), want (unknown, non-trustline error)", st, err)
	}
}

func TestHorizonSourceBalances(t *testing.T) {
	body := func(extra string) string {
		return `{"id":"` + addr("A") + `","account_id":"` + addr("A") + `","sequence":"1","balances":[` +
			`{"balance":"10.0000000","asset_type":"native"}` + extra + `]}`
	}
	cases := []struct {
		name  string
		extra string
		want  Status
	}{
		{"native only", ``, StatusNoTrustline},
		{"usdc trustline", `,{"balance":"0.0000000","limit":"922337203685.4775807","asset_type":"credit_alphanum4","asset_code":"USDC","asset_issuer":"` + usdcIssuer + `"}`, StatusOK},
		{"usdc other issuer", `,{"balance":"0.0000000","limit":"922337203685.4775807","asset_type":"credit_alphanum4","asset_code":"USDC","asset_issuer":"` + otherIssuer + `"}`, StatusNoTrustline},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v := newHorizonTestVerifier(t, func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(body(c.extra)))
			})
			st, err := v.Verify(context.Background(), addr("A"))
			if err != nil || st != c.want {
				t.Fatalf("got (%v, %v), want (%v, nil)", st, err, c.want)
			}
		})
	}
}
