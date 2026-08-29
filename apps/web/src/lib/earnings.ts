export interface ParticipantEarningsItem {
	id: string;
	txHash: string;
	amountUsdc: number;
	amountFormatted: string;
	confirmedAt: string;
	eventName: string;
	eventId: string;
	prizeRank: number;
	network: "testnet" | "mainnet";
}

export interface EarningsSummary {
	totalEarnedUsdc: number;
	totalPayoutsCount: number;
	distinctEventsCount: number;
	latestPayoutDate: string | null;
}

export const DEMO_PARTICIPANT_EARNINGS: ParticipantEarningsItem[] = [
	{
		id: "payout-001",
		txHash: "6b8a2e4c9f1a3d5e7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
		amountUsdc: 2500.0,
		amountFormatted: "2,500.00",
		confirmedAt: "2026-08-25T14:32:00.000Z",
		eventName: "Stellar Global Builders Hackathon 2026",
		eventId: "stellar-hackathon-2026",
		prizeRank: 1,
		network: "testnet",
	},
	{
		id: "payout-002",
		txHash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
		amountUsdc: 1000.0,
		amountFormatted: "1,000.00",
		confirmedAt: "2026-08-18T10:15:00.000Z",
		eventName: "Soroban DeFi Innovation Sprint",
		eventId: "soroban-defi-sprint",
		prizeRank: 2,
		network: "testnet",
	},
	{
		id: "payout-003",
		txHash: "3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d",
		amountUsdc: 500.0,
		amountFormatted: "500.00",
		confirmedAt: "2026-08-04T18:45:00.000Z",
		eventName: "Meridian 2026 Fast Micropayments Track",
		eventId: "meridian-micropayments-2026",
		prizeRank: 3,
		network: "testnet",
	},
];

export function calculateEarningsSummary(
	payouts: ParticipantEarningsItem[],
): EarningsSummary {
	if (!payouts || payouts.length === 0) {
		return {
			totalEarnedUsdc: 0,
			totalPayoutsCount: 0,
			distinctEventsCount: 0,
			latestPayoutDate: null,
		};
	}

	const totalEarnedUsdc = payouts.reduce(
		(acc, curr) => acc + curr.amountUsdc,
		0,
	);
	const uniqueEventIds = new Set(payouts.map((p) => p.eventId));

	const sorted = [...payouts].sort(
		(a, b) =>
			new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime(),
	);

	return {
		totalEarnedUsdc: Math.round(totalEarnedUsdc * 100) / 100,
		totalPayoutsCount: payouts.length,
		distinctEventsCount: uniqueEventIds.size,
		latestPayoutDate: sorted[0]?.confirmedAt ?? null,
	};
}
