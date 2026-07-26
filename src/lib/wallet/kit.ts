"use client";

import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import {
	FREIGHTER_ID,
	FreighterModule,
} from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { STELLAR_NETWORK } from "../stellar-network";

// StellarWalletsKit is a static/global class (v2.5.0 API — verified against
// the installed package's own .d.ts files, not the README, which documents
// an unreleased JSR-only rewrite under a different package name that isn't
// on npm). init() must run exactly once, and only in the browser — this
// module is "use client", but Next.js still executes "use client" module
// top-level code during SSR, so the actual init() call is guarded and
// triggered from a useEffect in the provider, never at import time here.
let initialized = false;

export function initWalletKit() {
	if (initialized || typeof window === "undefined") return;
	initialized = true;

	StellarWalletsKit.init({
		network: STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
		modules: [
			new FreighterModule(),
			new AlbedoModule(),
			new xBullModule(),
			new LobstrModule(),
		],
	});
}

export { FREIGHTER_ID, StellarWalletsKit };
