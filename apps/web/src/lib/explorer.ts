export type StellarNetwork = "testnet" | "mainnet" | "public";

export function getExplorerTxUrl(
	hash: string,
	network: StellarNetwork = "testnet",
): string {
	const explorerNetwork =
		network === "mainnet" || network === "public" ? "public" : "testnet";
	return `https://stellar.expert/explorer/${explorerNetwork}/tx/${hash}`;
}

export function truncateHash(hash: string, leading = 4, trailing = 4): string {
	if (!hash) return "";
	if (hash.length <= leading + trailing) return hash;
	return `${hash.slice(0, leading)}…${hash.slice(-trailing)}`;
}
