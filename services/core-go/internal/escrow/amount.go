// amount.go converts between Prize.amount's Decimal(18,7) text
// (apps/web/prisma/schema.prisma) and stroops, the token's smallest unit.
// The conversion is exact -- x10^7, no rounding -- because every Stellar
// Asset Contract (SAC) the event-escrow contract's `token` argument can
// name, native XLM or a classic asset wrapped as a SAC, has exactly 7
// decimals. A custom token with a different decimal count is out of scope:
// see AmountToStroops's own comment.
package escrow

import (
	"fmt"
	"strconv"
	"strings"
)

// stroopsPerUnit is 10^7 -- the fixed scale of every SAC's smallest unit
// relative to its display unit (e.g. 1 XLM = 10_000_000 stroops).
const stroopsPerUnit = 10_000_000

// AmountToStroops converts decimalText -- a Decimal(18,7) amount as
// Postgres/pgx renders it (e.g. "150.1234500"), such as Prize.amount read
// back by internal/store -- into stroops. The conversion is exact string
// arithmetic: no float ever enters this function, so there is no rounding
// to account for. It rejects a negative or zero amount, more than 7
// fractional digits, anything that isn't plain decimal digits, and any
// value that would overflow int64 stroops.
//
// This assumes a 7-decimal token (every SAC today). A custom token with a
// different decimal count would need a different scale factor; that case
// is out of scope here and unsupported.
func AmountToStroops(decimalText string) (int64, error) {
	s := decimalText
	if s == "" {
		return 0, fmt.Errorf("escrow: amount is empty")
	}
	if strings.HasPrefix(s, "-") {
		return 0, fmt.Errorf("escrow: amount %q must be positive", decimalText)
	}
	s = strings.TrimPrefix(s, "+")

	intPart, fracPart := s, ""
	if i := strings.IndexByte(s, '.'); i >= 0 {
		intPart, fracPart = s[:i], s[i+1:]
	}
	if intPart == "" || !isDigits(intPart) {
		return 0, fmt.Errorf("escrow: amount %q is not a valid decimal number", decimalText)
	}
	if len(fracPart) > 7 {
		return 0, fmt.Errorf("escrow: amount %q has more than 7 decimal places", decimalText)
	}
	if fracPart != "" && !isDigits(fracPart) {
		return 0, fmt.Errorf("escrow: amount %q is not a valid decimal number", decimalText)
	}

	digits := intPart + fracPart + strings.Repeat("0", 7-len(fracPart))
	stroops, err := strconv.ParseInt(digits, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("escrow: amount %q overflows int64 stroops: %w", decimalText, err)
	}
	if stroops <= 0 {
		return 0, fmt.Errorf("escrow: amount %q must be positive", decimalText)
	}
	return stroops, nil
}

// StroopsToAmount is AmountToStroops's inverse: it renders stroops as the
// Decimal(18,7) text the payouts.amount column stores (e.g.
// 10000000001 -> "1000.0000001").
func StroopsToAmount(stroops int64) string {
	neg := stroops < 0
	if neg {
		stroops = -stroops
	}
	whole := stroops / stroopsPerUnit
	frac := stroops % stroopsPerUnit
	s := fmt.Sprintf("%d.%07d", whole, frac)
	if neg {
		s = "-" + s
	}
	return s
}

func isDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
