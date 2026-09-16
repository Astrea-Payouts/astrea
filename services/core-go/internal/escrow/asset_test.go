package escrow

import (
	"testing"

	"github.com/stellar/go/network"
)

func TestClassicAssetContractID(t *testing.T) {
	// Vectors cross-checked against `stellar contract id asset --asset
	// CODE:ISSUER --network-passphrase "Test SDF Network ; September 2015"`,
	// the same tool the harness's README documents using to verify TOKEN.
	tests := []struct {
		name   string
		code   string
		issuer string
		want   string
	}{
		{
			name:   "testnet USDC",
			code:   "USDC",
			issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			want:   "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ClassicAssetContractID(tt.code, tt.issuer, network.TestNetworkPassphrase)
			if err != nil {
				t.Fatalf("ClassicAssetContractID(%q, %q) returned error: %v", tt.code, tt.issuer, err)
			}
			if got != tt.want {
				t.Errorf("ClassicAssetContractID(%q, %q) = %q, want %q", tt.code, tt.issuer, got, tt.want)
			}
		})
	}
}

func TestClassicAssetContractID_DifferentIssuersDiffer(t *testing.T) {
	a, err := ClassicAssetContractID("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", network.TestNetworkPassphrase)
	if err != nil {
		t.Fatalf("ClassicAssetContractID returned error: %v", err)
	}
	b, err := ClassicAssetContractID("USDC", "GBXPW3B3ZVAUJR4L2FC37GRGGFICOGGPZ5AAPIX6EF7KI2FMQ2ZBG3K2", network.TestNetworkPassphrase)
	if err != nil {
		t.Fatalf("ClassicAssetContractID returned error: %v", err)
	}
	if a == b {
		t.Fatalf("ClassicAssetContractID returned the same SAC id %q for two different issuers", a)
	}
}

func TestClassicAssetContractID_InvalidIssuer(t *testing.T) {
	if _, err := ClassicAssetContractID("USDC", "not-a-valid-issuer", network.TestNetworkPassphrase); err == nil {
		t.Fatal("ClassicAssetContractID with an invalid issuer address returned no error")
	}
}
