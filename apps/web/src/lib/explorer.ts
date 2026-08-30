export type StellarNetwork = "testnet" | "mainnet" | "public";

function explorerNetworkSegment(network: StellarNetwork): string {
	return network === "mainnet" || network === "public" ? "public" : "testnet";
}

export function getExplorerTxUrl(
	hash: string,
	network: StellarNetwork = "testnet",
): string {
	return `https://stellar.expert/explorer/${explorerNetworkSegment(network)}/tx/${hash}`;
}

export function getExplorerContractUrl(
	contractId: string,
	network: StellarNetwork = "testnet",
): string {
	return `https://stellar.expert/explorer/${explorerNetworkSegment(network)}/contract/${contractId}`;
}

export function truncateHash(hash: string, leading = 4, trailing = 4): string {
	if (!hash) return "";
	if (hash.length <= leading + trailing) return hash;
	return `${hash.slice(0, leading)}…${hash.slice(-trailing)}`;
}
