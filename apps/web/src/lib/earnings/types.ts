export interface EarningsItem {
	id: string;
	eventId: string;
	eventName: string;
	prizeRank: number;
	milestoneIndex: number;
	amountUsdc: string;
	amountUsdcNum: number;
	txHash: string;
	confirmedAt: string;
	network: "testnet" | "mainnet";
}

export interface EarningsSummary {
	totalUsdc: string;
	totalUsdcNum: number;
	totalPrizesCount: number;
	totalEventsCount: number;
	averageUsdc: string;
	latestPayoutDate: string | null;
}

export type EarningsSortOption =
	| "date-desc"
	| "date-asc"
	| "amount-desc"
	| "amount-asc";

export interface EarningsFilter {
	searchQuery: string;
	sortBy: EarningsSortOption;
}
