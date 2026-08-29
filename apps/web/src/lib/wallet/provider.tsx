"use client";

import { KitEventType } from "@creit.tech/stellar-wallets-kit/types";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { initWalletKit, StellarWalletsKit } from "./kit";
import {
	associateVerifiedWallet,
	clearWalletSession,
	getAuthNonce,
} from "./session";

type WalletContextValue = {
	address: string | null;
	isConnecting: boolean;
	connect: () => Promise<void>;
	disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
	const [address, setAddress] = useState<string | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);

	useEffect(() => {
		initWalletKit();
		// Fires once at launch with whatever address the kit already knows
		// about (e.g. a wallet extension that stayed authorized), and again
		// on every subsequent change.
		return StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
			setAddress(event.payload.address ?? null);
		});
	}, []);

	const connect = useCallback(async () => {
		setIsConnecting(true);
		try {
			// The wallet connection itself (talking to the extension) is the
			// part that must not fail silently — surface errors from this.
			const { address: connected } = await StellarWalletsKit.authModal();
			setAddress(connected);

			// Server-side signed challenge-response session (S07 / SEP-0043):
			// The wallet signs a server-issued challenge nonce to prove control of the address.
			try {
				const { nonce, message } = await getAuthNonce(connected);
				const { signedMessage } = await StellarWalletsKit.signMessage(message, {
					address: connected,
				});
				await associateVerifiedWallet({
					address: connected,
					signature: signedMessage,
					nonce,
				});
			} catch (err) {
				console.error(
					"Wallet connected, but session verification failed:",
					err,
				);
			}
		} finally {
			setIsConnecting(false);
		}
	}, []);

	const disconnect = useCallback(async () => {
		await StellarWalletsKit.disconnect();
		setAddress(null);
		await clearWalletSession();
	}, []);

	return (
		<WalletContext.Provider
			value={{ address, isConnecting, connect, disconnect }}
		>
			{children}
		</WalletContext.Provider>
	);
}

export function useWallet() {
	const context = useContext(WalletContext);
	if (!context) {
		throw new Error("useWallet must be used within a WalletProvider");
	}
	return context;
}
