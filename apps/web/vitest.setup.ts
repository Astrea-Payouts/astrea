// env.ts validates required vars at import time (S04). Tests that import
// modules depending on it (src/lib/escrow/*) need these present even though
// they never hit the real network — fetch/Horizon calls are mocked per test.
// env.test.ts manages these keys itself per test and overrides these defaults.
process.env.TW_API_KEY ??= "test-key";
process.env.USDC_ISSUER ??=
	"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
process.env.DATABASE_URL ??=
	"postgresql://postgres:postgres@localhost:5432/astrea_test";
