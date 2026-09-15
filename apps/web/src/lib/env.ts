import { z } from "zod";
import {
	DEFAULT_SOROBAN_RPC_URL,
	HORIZON_URL,
	STELLAR_ACCOUNT_ID,
	STELLAR_CONTRACT_ID,
	STELLAR_NETWORK_PASSPHRASE,
} from "./stellar-network";

// Single source of truth for which Stellar network the app targets.
// Deliberately NEXT_PUBLIC_ (not a secret) so server and client can never
// disagree about network — a duplicated STELLAR_NETWORK + a separate
// NEXT_PUBLIC_STELLAR_NETWORK would let them drift, which is exactly the
// testnet/mainnet mix-up failure mode documented in docs/architecture.md.
// The network → passphrase/Horizon mapping itself lives in stellar-network.ts
// (client-safe) so it isn't duplicated between the server and client configs.

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
	// Same "server and client must never disagree" reasoning as
	// NEXT_PUBLIC_STELLAR_NETWORK above — also NEXT_PUBLIC_ on purpose: it's
	// not a secret, and the client builds stellar.expert links from it.
	NEXT_PUBLIC_ESCROW_CONTRACT_ID: z
		.string()
		.regex(
			STELLAR_CONTRACT_ID,
			"NEXT_PUBLIC_ESCROW_CONTRACT_ID must be a Soroban contract ID: starts with C, 56 characters total, base32 (A-Z, 2-7) after that",
		),
	// Optional override; defaults to the public testnet RPC (stellar-network.ts).
	// No free public mainnet Soroban RPC exists, so this becomes required
	// below when NEXT_PUBLIC_STELLAR_NETWORK=mainnet.
	// A blank `SOROBAN_RPC_URL=` line (what .env.example ships) means unset.
	SOROBAN_RPC_URL: z.preprocess(
		(v) => (v === "" ? undefined : v),
		z.url().optional(),
	),
	USDC_ISSUER: z
		.string()
		.regex(
			STELLAR_ACCOUNT_ID,
			"USDC_ISSUER must be a Stellar account ID (starts with G, 56 chars)",
		),
	USDC_SYMBOL: z.string().min(1).default("USDC"),
	// services/core-go — the only writer of transactional state. Server-only:
	// every /build and /submit goes through a server action (issue #15,
	// decision 1). The token is the shared bearer secret Go checks with a
	// constant-time compare; it is never NEXT_PUBLIC_ and never logged.
	CORE_GO_URL: z.url(),
	CORE_GO_SERVICE_TOKEN: z.string().min(32),
});

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

	if (data.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" && !data.SOROBAN_RPC_URL) {
		throw new Error(
			"SOROBAN_RPC_URL is required when NEXT_PUBLIC_STELLAR_NETWORK=mainnet — " +
				"there is no free public mainnet Soroban RPC to default to. Set " +
				"SOROBAN_RPC_URL to your provider's mainnet endpoint.",
		);
	}

	return {
		...data,
		networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
		horizonUrl: HORIZON_URL,
		sorobanRpcUrl: data.SOROBAN_RPC_URL ?? DEFAULT_SOROBAN_RPC_URL,
	};
}

type Env = ReturnType<typeof parseEnv>;

let parsed: Env | undefined;

// Parsed once, on first property access, and cached — any invalid/missing
// var fails the first server action, route handler, page render or script
// that touches it, with the full list of problems, rather than surfacing as
// a confusing runtime error deep in an escrow call. Not at module load:
// `next build` imports every page module to collect its config, with no
// runtime env present in CI, and a throw there fails the build instead of
// the request.
export const env: Env = new Proxy({} as Env, {
	get(_target, prop) {
		parsed ??= parseEnv();
		return parsed[prop as keyof Env];
	},
	has(_target, prop) {
		parsed ??= parseEnv();
		return prop in parsed;
	},
	ownKeys() {
		parsed ??= parseEnv();
		return Reflect.ownKeys(parsed);
	},
	getOwnPropertyDescriptor(_target, prop) {
		parsed ??= parseEnv();
		const desc = Object.getOwnPropertyDescriptor(parsed, prop);
		return desc ? { ...desc, configurable: true } : undefined;
	},
});
