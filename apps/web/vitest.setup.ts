// env.ts validates required vars at import time (S04). Tests that import
// modules depending on it (src/lib/escrow/*) need these present even though
// they never hit the real network — fetch/Horizon calls are mocked per test.
// env.test.ts manages these keys itself per test and overrides these defaults.
process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ??=
	"CAD5IOA2FFSUTRIHEK6YQ2BPO2JVDPXYRXBVMPBBWFQEWRWKFRG36TQH";
process.env.USDC_ISSUER ??=
	"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
process.env.DATABASE_URL ??=
	"postgresql://postgres:postgres@localhost:5432/postgres";
process.env.CORE_GO_URL ??= "http://localhost:8080";
process.env.CORE_GO_SERVICE_TOKEN ??= "test-token-".repeat(4);
