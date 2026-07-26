import { Networks } from "@stellar/stellar-sdk";
import { z } from "zod";

// Single source of truth for which Stellar network the app targets.
// Deliberately NEXT_PUBLIC_ (not a secret) so server and client can never
// disagree about network — a duplicated STELLAR_NETWORK + a separate
// NEXT_PUBLIC_STELLAR_NETWORK would let them drift, which is exactly the
// testnet/mainnet mix-up failure mode documented in docs/architecture.md.
const STELLAR_ACCOUNT_ID = /^G[A-Z2-7]{55}$/;

const serverSchema = z.object({
	NEXT_PUBLIC_STELLAR_NETWORK: z
		.enum(["testnet", "mainnet"])
		.default("testnet"),
	// Explicit gate per docs/architecture.md ("mainnet behind explicit gate") —
	// setting NEXT_PUBLIC_STELLAR_NETWORK=mainnet alone is not enough.
	ALLOW_MAINNET: z
		.enum(["true", "false"])
		.default("false")
		.transform((v) => v === "true"),
	TW_API_URL: z.url().default("https://dev.api.trustlesswork.com"),
	TW_API_KEY: z
		.string()
		.min(
			1,
			"TW_API_KEY is required — request one at https://dapp.trustlesswork.com",
		),
	USDC_ISSUER: z
		.string()
		.regex(
			STELLAR_ACCOUNT_ID,
			"USDC_ISSUER must be a Stellar account ID (starts with G, 56 chars)",
		),
	USDC_SYMBOL: z.string().min(1).default("USDC"),
});

const NETWORK_CONFIG = {
	testnet: {
		passphrase: Networks.TESTNET,
		horizonUrl: "https://horizon-testnet.stellar.org",
	},
	mainnet: {
		passphrase: Networks.PUBLIC,
		horizonUrl: "https://horizon.stellar.org",
	},
} as const;

function parseEnv() {
	const parsed = serverSchema.safeParse(process.env);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");
		throw new Error(`Invalid environment configuration:\n${issues}`);
	}

	const data = parsed.data;

	if (data.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" && !data.ALLOW_MAINNET) {
		throw new Error(
			"NEXT_PUBLIC_STELLAR_NETWORK=mainnet requires ALLOW_MAINNET=true to be set " +
				"explicitly. This is a deliberate gate (docs/architecture.md), not a bug — " +
				"remove ALLOW_MAINNET or set it to true only when you mean it.",
		);
	}

	const network = NETWORK_CONFIG[data.NEXT_PUBLIC_STELLAR_NETWORK];

	return {
		...data,
		networkPassphrase: network.passphrase,
		horizonUrl: network.horizonUrl,
	};
}

// Parsed once at module load — any invalid/missing var fails the boot
// immediately (a Next.js server action, route handler, or script importing
// this module) rather than surfacing as a confusing runtime error deep in
// an escrow call.
export const env = parseEnv();
