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
	getSessionWallet,
} from "./session";
import { UNSUPPORTED_ALBEDO_MESSAGE } from "./validation";

export { UNSUPPORTED_ALBEDO_MESSAGE };

export type WalletContextValue = {
	address: string | null;
	isConnecting: boolean;
	authError: string | null;
	connect: () => Promise<void>;
	disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
	const [address, setAddress] = useState<string | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [authError, setAuthError] = useState<string | null>(null);

	useEffect(() => {
		initWalletKit();

		// Rehydrate verified session if cookie exists on the server
		getSessionWallet()
			.then((wallet) => {
				if (wallet?.address) {
					setAddress(wallet.address);
				}
			})
			.catch(() => {});

		// Sync when wallet extension signals a disconnect
		return StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
			if (!event.payload.address) {
				setAddress(null);
			}
		});
	}, []);

	const connect = useCallback(async () => {
		setIsConnecting(true);
		setAuthError(null);
		try {
			// The wallet connection itself (talking to the extension)
			const { address: connected } = await StellarWalletsKit.authModal();

			// Check if active wallet is Albedo (does not support SEP-0043 signMessage)
			let selectedId: string | null = null;
			try {
				selectedId = StellarWalletsKit.selectedModule?.productId ?? null;
			} catch {
				// No active module
			}

			if (selectedId === "albedo") {
				await StellarWalletsKit.disconnect().catch(() => {});
				setAddress(null);
				setAuthError(UNSUPPORTED_ALBEDO_MESSAGE);
				throw new Error(UNSUPPORTED_ALBEDO_MESSAGE);
			}

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

				// Only treat the connection as fully successful once session verification completes
				setAddress(connected);
			} catch (err: unknown) {
				console.error(
					"Wallet connected, but session verification failed:",
					err,
				);
				await StellarWalletsKit.disconnect().catch(() => {});
				await clearWalletSession().catch(() => {});
				setAddress(null);

				const errMsg =
					err instanceof Error
						? err.message
						: typeof err === "object" && err !== null && "message" in err
							? String((err as { message: unknown }).message)
							: "Session verification failed";

				if (
					errMsg.includes('Albedo does not support the "signMessage"') ||
					errMsg.includes("signMessage")
				) {
					setAuthError(UNSUPPORTED_ALBEDO_MESSAGE);
					throw new Error(UNSUPPORTED_ALBEDO_MESSAGE);
				}

				setAuthError(errMsg);
				throw err;
			}
		} finally {
			setIsConnecting(false);
		}
	}, []);

	const disconnect = useCallback(async () => {
		await StellarWalletsKit.disconnect().catch(() => {});
		setAddress(null);
		setAuthError(null);
		await clearWalletSession().catch(() => {});
	}, []);

	return (
		<WalletContext.Provider
			value={{ address, isConnecting, authError, connect, disconnect }}
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
