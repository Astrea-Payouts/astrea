package escrow

import "testing"

func TestAmountToStroops_Table(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    int64
		wantErr bool
	}{
		{name: "round amount", input: "150.0000000", want: 1_500_000_000},
		{name: "non-round amount", input: "150.1234500", want: 1_501_234_500},
		{name: "smallest unit", input: "75.0000001", want: 750_000_001},
		{name: "max 7 decimals, all nines", input: "25.9999999", want: 259_999_999},
		{name: "no fractional part", input: "1000", want: 10_000_000_000},
		{name: "fewer than 7 decimals padded", input: "1.5", want: 15_000_000},
		{name: "explicit plus sign", input: "+3.5", want: 35_000_000},
		{name: "empty", input: "", wantErr: true},
		{name: "negative", input: "-1.0000000", wantErr: true},
		{name: "zero", input: "0", wantErr: true},
		{name: "zero with decimals", input: "0.0000000", wantErr: true},
		{name: "too many decimals", input: "1.00000001", wantErr: true},
		{name: "non-numeric", input: "abc", wantErr: true},
		{name: "non-numeric fraction", input: "1.abc", wantErr: true},
		{name: "malformed double dot", input: "1.2.3", wantErr: true},
		{name: "overflows int64", input: "99999999999999999999.0000000", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := AmountToStroops(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("AmountToStroops(%q) = %d, want an error", tt.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("AmountToStroops(%q) returned error: %v", tt.input, err)
			}
			if got != tt.want {
				t.Errorf("AmountToStroops(%q) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}

func TestStroopsToAmount_Table(t *testing.T) {
	tests := []struct {
		name  string
		input int64
		want  string
	}{
		{name: "round amount", input: 1_500_000_000, want: "150.0000000"},
		{name: "non-round amount", input: 1_501_234_500, want: "150.1234500"},
		{name: "smallest unit", input: 10_000_000_001, want: "1000.0000001"},
		{name: "one stroop", input: 1, want: "0.0000001"},
		{name: "zero", input: 0, want: "0.0000000"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := StroopsToAmount(tt.input); got != tt.want {
				t.Errorf("StroopsToAmount(%d) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

// TestAmountStroopsRoundTrip proves AmountToStroops and StroopsToAmount are
// exact inverses over several non-round values -- the exactness the
// contract's i128 amounts depend on (#185 decision 2).
func TestAmountStroopsRoundTrip(t *testing.T) {
	amounts := []string{
		"150.1234500",
		"75.0000001",
		"25.9999999",
		"1000.0000001",
		"0.0000001",
		"999999999.9999999",
	}
	for _, amount := range amounts {
		stroops, err := AmountToStroops(amount)
		if err != nil {
			t.Fatalf("AmountToStroops(%q) returned error: %v", amount, err)
		}
		got := StroopsToAmount(stroops)
		if got != amount {
			t.Errorf("round-trip: AmountToStroops(%q) -> %d -> StroopsToAmount = %q, want %q", amount, stroops, got, amount)
		}
	}
}

func TestParseEventID_Valid(t *testing.T) {
	id, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	hexStr := id.String()

	got, err := ParseEventID(hexStr)
	if err != nil {
		t.Fatalf("ParseEventID(%q) returned error: %v", hexStr, err)
	}
	if got != id {
		t.Errorf("ParseEventID(%q) = %v, want %v", hexStr, got, id)
	}
}

func TestParseEventID_Invalid(t *testing.T) {
	tests := []string{
		"",
		"tooshort",
		"0123456789abcdef0123456789abcdef00", // too long
		"0123456789ABCDEF0123456789abcdef",   // uppercase
		"0123456789abcdef0123456789abcdeg",   // non-hex char
	}
	for _, tt := range tests {
		if _, err := ParseEventID(tt); err == nil {
			t.Errorf("ParseEventID(%q) = nil error, want an error", tt)
		}
	}
}
