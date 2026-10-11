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

// usdcJSON renders one Horizon credit balance line. An empty authorized
// omits is_authorized entirely.
func usdcJSON(issuer, balance, limit, buyingLiabilities, authorized string) string {
	auth := ""
	if authorized != "" {
		auth = `,"is_authorized":` + authorized
	}
	return `,{"balance":"` + balance + `","limit":"` + limit + `","buying_liabilities":"` + buyingLiabilities +
		`","asset_type":"credit_alphanum4","asset_code":"USDC","asset_issuer":"` + issuer + `"` + auth + `}`
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
		{"usdc trustline", usdcJSON(usdcIssuer, "0.0000000", "922337203685.4775807", "0.0000000", `true`), StatusOK},
		{"usdc other issuer", usdcJSON(otherIssuer, "0.0000000", "922337203685.4775807", "0.0000000", `true`), StatusNoTrustline},
		{"usdc not authorized", usdcJSON(usdcIssuer, "0.0000000", "922337203685.4775807", "0.0000000", `false`), StatusNotAuthorized},
		{"usdc is_authorized missing fails closed", usdcJSON(usdcIssuer, "0.0000000", "922337203685.4775807", "0.0000000", ``), StatusNotAuthorized},
		{"usdc limit zero", usdcJSON(usdcIssuer, "0.0000000", "0.0000000", "0.0000000", `true`), StatusInsufficientLimit},
		{"usdc balance at limit", usdcJSON(usdcIssuer, "5.0000000", "5.0000000", "0.0000000", `true`), StatusInsufficientLimit},
		{"usdc room taken by buying liabilities", usdcJSON(usdcIssuer, "2.0000000", "5.0000000", "3.0000000", `true`), StatusInsufficientLimit},
		{"usdc one stroop of room", usdcJSON(usdcIssuer, "2.0000000", "5.0000000", "2.9999999", `true`), StatusOK},
		{"liquidity pool share line is ignored", `,{"balance":"1.0000000","limit":"10.0000000","asset_type":"liquidity_pool_shares","liquidity_pool_id":"abc"}`, StatusNoTrustline},
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

// A malformed amount from Horizon is a lookup error, never a classification.
func TestHorizonSourceBadAmountIsError(t *testing.T) {
	v := newHorizonTestVerifier(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"` + addr("A") + `","account_id":"` + addr("A") + `","sequence":"1","balances":[` +
			`{"balance":"0.0000000","limit":"lots","asset_type":"credit_alphanum4","asset_code":"USDC","asset_issuer":"` + usdcIssuer + `","is_authorized":true}]}`))
	})
	st, err := v.Verify(context.Background(), addr("A"))
	if err == nil || st != StatusUnknown || errors.Is(err, ErrNoTrustline) {
		t.Fatalf("got (%v, %v), want (unknown, non-trustline error)", st, err)
	}
}

func TestTrustlineHeadroom(t *testing.T) {
	for _, c := range []struct {
		limit, balance, buying string
		want                   int64
	}{
		{"10.0000000", "3.0000000", "", 7_0000000},
		{"10.0000000", "3.0000000", "2.5000000", 4_5000000},
		{"1.0000000", "3.0000000", "0.0000000", 0}, // over limit (limit lowered) never goes negative
		{"", "", "", 0},
	} {
		got, err := trustlineHeadroom(c.limit, c.balance, c.buying)
		if err != nil || got != c.want {
			t.Errorf("headroom(%q, %q, %q) = (%d, %v), want %d", c.limit, c.balance, c.buying, got, err, c.want)
		}
	}
	for _, bad := range [][3]string{{"x", "0", "0"}, {"1", "x", "0"}, {"1", "0", "x"}} {
		if _, err := trustlineHeadroom(bad[0], bad[1], bad[2]); err == nil {
			t.Errorf("headroom(%q) should fail", bad)
		}
	}
}

// An already-cancelled context never reaches Horizon.
func TestHorizonSourceCancelledContext(t *testing.T) {
	called := false
	v := newHorizonTestVerifier(t, func(w http.ResponseWriter, _ *http.Request) {
		called = true
	})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	st, err := v.Verify(ctx, addr("A"))
	if !errors.Is(err, context.Canceled) || st != StatusUnknown {
		t.Fatalf("got (%v, %v), want (unknown, context.Canceled)", st, err)
	}
	if called {
		t.Error("Horizon was called with a cancelled context")
	}
}
