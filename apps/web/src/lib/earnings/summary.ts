import type { EarningsFilter, EarningsItem, EarningsSummary } from "./types";

/**
 * Aggregates verified on-chain payout metrics for a participant.
 * Pure function with zero dependencies, safe for both SSR and client hydration.
 */
export function calculateEarningsSummary(
	items: EarningsItem[],
): EarningsSummary {
	if (items.length === 0) {
		return {
			totalUsdc: "0",
			totalUsdcNum: 0,
			totalPrizesCount: 0,
			totalEventsCount: 0,
			averageUsdc: "0",
			latestPayoutDate: null,
		};
	}

	let totalNum = 0;
	const distinctEvents = new Set<string>();
	let latestTime = 0;
	let latestDateStr: string | null = null;

	for (const item of items) {
		totalNum += item.amountUsdcNum;
		distinctEvents.add(item.eventId);

		const time = new Date(item.confirmedAt).getTime();
		if (time > latestTime) {
			latestTime = time;
			latestDateStr = item.confirmedAt;
		}
	}

	const avg = totalNum / items.length;

	return {
		totalUsdc: totalNum.toLocaleString("en-US", { maximumFractionDigits: 0 }),
		totalUsdcNum: totalNum,
		totalPrizesCount: items.length,
		totalEventsCount: distinctEvents.size,
		averageUsdc: avg.toLocaleString("en-US", { maximumFractionDigits: 0 }),
		latestPayoutDate: latestDateStr,
	};
}

/**
 * Filters and sorts earnings history items according to user preferences.
 */
export function filterAndSortEarnings(
	items: EarningsItem[],
	filter: EarningsFilter,
): EarningsItem[] {
	let result = [...items];

	// Filter by search query (event name, tx hash, rank, amount)
	if (filter.searchQuery.trim()) {
		const q = filter.searchQuery.toLowerCase().trim();
		result = result.filter(
			(item) =>
				item.eventName.toLowerCase().includes(q) ||
				item.txHash.toLowerCase().includes(q) ||
				item.amountUsdc.toLowerCase().includes(q),
		);
	}

	// Sort order
	switch (filter.sortBy) {
		case "date-asc":
			result.sort(
				(a, b) =>
					new Date(a.confirmedAt).getTime() - new Date(b.confirmedAt).getTime(),
			);
			break;
		case "amount-desc":
			result.sort((a, b) => b.amountUsdcNum - a.amountUsdcNum);
			break;
		case "amount-asc":
			result.sort((a, b) => a.amountUsdcNum - b.amountUsdcNum);
			break;
		default:
			result.sort(
				(a, b) =>
					new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime(),
			);
			break;
	}

	return result;
}

/**
 * Formats a localized date string from ISO timestamp.
 */
export function formatPayoutDate(isoDate: string): string {
	const d = new Date(isoDate);
	if (Number.isNaN(d.getTime())) return "TBD";

	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
