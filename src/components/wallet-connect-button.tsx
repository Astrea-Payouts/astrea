"use client";

import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet/provider";

function truncate(address: string) {
	return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletConnectButton() {
	const { address, isConnecting, connect, disconnect } = useWallet();

	if (address) {
		return (
			<Button variant="outline" onClick={disconnect}>
				{truncate(address)}
			</Button>
		);
	}

	return (
		<Button onClick={connect} disabled={isConnecting}>
			{isConnecting ? "Connecting…" : "Connect wallet"}
		</Button>
	);
}
