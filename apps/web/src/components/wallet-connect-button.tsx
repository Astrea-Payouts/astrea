"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet/provider";

function truncate(address: string) {
	return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletConnectButton({ className }: { className?: string }) {
	const t = useTranslations("WalletConnect");
	const { address, isConnecting, connect, disconnect } = useWallet();

	if (address) {
		return (
			<Button variant="outline" onClick={disconnect} className={className}>
				{truncate(address)}
			</Button>
		);
	}

	return (
		<Button onClick={connect} disabled={isConnecting} className={className}>
			{isConnecting ? t("connecting") : t("connect")}
		</Button>
	);
}
