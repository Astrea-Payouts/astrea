package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stellar/go/keypair"
)

const testServiceToken = "01234567890123456789012345678901"

func testRouter(t *testing.T) http.Handler {
	t.Helper()
	return New(Deps{ServiceToken: testServiceToken})
}

func validWallet(t *testing.T) string {
	t.Helper()
	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random: %v", err)
	}
	return kp.Address()
}

func TestHealthz_Unauthenticated(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Body.String() != "ok" {
		t.Errorf("body = %q, want %q", rec.Body.String(), "ok")
	}
}

func TestWhoami_MissingBearer(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("X-Astrea-Wallet", validWallet(t))
	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	assertErrorStatus(t, rec, http.StatusUnauthorized, "unauthorized")
}

func TestWhoami_WrongBearer(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("Authorization", "Bearer not-the-token")
	req.Header.Set("X-Astrea-Wallet", validWallet(t))
	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	assertErrorStatus(t, rec, http.StatusUnauthorized, "unauthorized")
}

func TestWhoami_MalformedAuthorizationHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	// No "Bearer " prefix at all — not just a wrong token.
	req.Header.Set("Authorization", testServiceToken)
	req.Header.Set("X-Astrea-Wallet", validWallet(t))
	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	assertErrorStatus(t, rec, http.StatusUnauthorized, "unauthorized")
}

func TestWhoami_MissingWallet(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("Authorization", "Bearer "+testServiceToken)
	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_wallet")
}

func TestWhoami_MalformedWallet(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("Authorization", "Bearer "+testServiceToken)
	req.Header.Set("X-Astrea-Wallet", "not-a-stellar-address")
	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_wallet")
}

// TestWhoami_ContractAddressRejected proves the middleware checks the
// wallet is specifically an *account* address (G...), not any valid
// strkey — a C... contract address must not authenticate as a judge.
func TestWhoami_ContractAddressRejected(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("Authorization", "Bearer "+testServiceToken)
	req.Header.Set("X-Astrea-Wallet", "CAAACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6N4O")
	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_wallet")
}

func TestWhoami_Success(t *testing.T) {
	wallet := validWallet(t)
	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("Authorization", "Bearer "+testServiceToken)
	req.Header.Set("X-Astrea-Wallet", wallet)
	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["wallet"] != wallet {
		t.Errorf("wallet = %q, want %q", body["wallet"], wallet)
	}
}

func assertErrorStatus(t *testing.T, rec *httptest.ResponseRecorder, wantStatus int, wantCode string) {
	t.Helper()
	if rec.Code != wantStatus {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, wantStatus, rec.Body.String())
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body: %v; body: %s", err, rec.Body.String())
	}
	if body.Error.Code != wantCode {
		t.Errorf("error.code = %q, want %q", body.Error.Code, wantCode)
	}
	if body.Error.Message == "" {
		t.Errorf("error.message is empty")
	}
}
