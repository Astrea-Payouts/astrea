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

function explorerNetwork(network: StellarNetwork): "public" | "testnet" {
	return network === "mainnet" || network === "public" ? "public" : "testnet";
}

export function getExplorerContractUrl(
	contractId: string,
	network: StellarNetwork = "testnet",
): string {
	return `https://stellar.expert/explorer/${explorerNetwork(network)}/contract/${contractId}`;
}

export function getExplorerAccountUrl(
	address: string,
	network: StellarNetwork = "testnet",
): string {
	return `https://stellar.expert/explorer/${explorerNetwork(network)}/account/${address}`;
}

// Soroban amounts arrive as integers in the token's smallest unit (7
// decimals for a classic-asset SAC such as USDC). BigInt string math so a
// reward never goes through a float.
export function formatSmallestUnits(amount: string, decimals = 7): string {
	const negative = amount.startsWith("-");
	const digits = (negative ? amount.slice(1) : amount).padStart(
		decimals + 1,
		"0",
	);
	const whole = digits.slice(0, digits.length - decimals);
	const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
	return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}
