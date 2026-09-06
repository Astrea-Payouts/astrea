package notify

import (
	"math"
)

// IsRegistrationMilestone determines if a participant count hits an organizer notification milestone
// per ADR-007 (triangular-number decay: 10, 30, 60, 100, 150, 210, 280, 360, ...).
//
// The interval grows by 10 each time (10, 20, 30, 40, ...), preventing high-volume low-engagement
// email spam and protecting domain sending reputation without imposing arbitrary ceilings.
func IsRegistrationMilestone(count int) bool {
	if count <= 0 || count%10 != 0 {
		return false
	}

	m := count / 10
	// For m to be triangular (m = k*(k+1)/2): 8*m + 1 must be a perfect square,
	// and its square root must be an odd positive integer.
	disc := 8*m + 1
	root := int(math.Round(math.Sqrt(float64(disc))))
	return root*root == disc && root%2 == 1
}

// NextRegistrationMilestone calculates the next milestone count strictly greater than currentCount.
func NextRegistrationMilestone(currentCount int) int {
	if currentCount < 10 {
		return 10
	}

	// S_k = 5 * k * (k + 1)
	// Solving quadratic 5k^2 + 5k - S = 0 gives:
	// k = (-5 + sqrt(25 + 20*S)) / 10
	k := int(math.Floor((-5.0 + math.Sqrt(float64(25+20*currentCount))) / 10.0))
	nextK := k + 1
	return 5 * nextK * (nextK + 1)
}
