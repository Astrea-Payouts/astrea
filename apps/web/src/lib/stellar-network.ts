import { Networks } from "@stellar/stellar-sdk";

// Client-safe network config — NO secrets, safe to import from client
// components (unlike src/lib/env.ts, which validates server-only vars and
// would break the client bundle if imported there).
//
// NEXT_PUBLIC_STELLAR_NETWORK is the single source of truth for which
// network the app targets — see src/lib/env.ts for why it's public.

export const STELLAR_ACCOUNT_ID = /^G[A-Z2-7]{55}$/;
export const STELLAR_CONTRACT_ID = /^C[A-Z2-7]{55}$/;

export type StellarNetworkName = "testnet" | "mainnet";

export const STELLAR_NETWORK: StellarNetworkName =
	process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

const NETWORK_CONFIG: Record<
	StellarNetworkName,
	{ passphrase: string; horizonUrl: string; sorobanRpcUrl?: string }
> = {
	testnet: {
		passphrase: Networks.TESTNET,
		horizonUrl: "https://horizon-testnet.stellar.org",
		sorobanRpcUrl: "https://soroban-testnet.stellar.org",
	},
	mainnet: {
		passphrase: Networks.PUBLIC,
		horizonUrl: "https://horizon.stellar.org",
		// No free public mainnet Soroban RPC default exists — env.ts requires
		// SOROBAN_RPC_URL explicitly when NEXT_PUBLIC_STELLAR_NETWORK=mainnet.
	},
};

export const STELLAR_NETWORK_PASSPHRASE =
	NETWORK_CONFIG[STELLAR_NETWORK].passphrase;
export const HORIZON_URL = NETWORK_CONFIG[STELLAR_NETWORK].horizonUrl;
export const DEFAULT_SOROBAN_RPC_URL =
	NETWORK_CONFIG[STELLAR_NETWORK].sorobanRpcUrl;
