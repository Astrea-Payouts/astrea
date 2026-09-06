import type { EarningsItem } from "./types";

/**
 * Realistic seeded on-chain payouts for demonstration and offline development.
 * Every item includes a valid 64-character hex transaction hash matching Stellar Horizon specs.
 */
export function getSampleEarnings(_walletAddress: string): EarningsItem[] {
	return [
		{
			id: "pay_soroban_defi_1st_place",
			eventId: "evt-soroban-hackathon-2026",
			eventName: "Soroban DeFi & Smart Contracts Hackathon",
			prizeRank: 1,
			milestoneIndex: 0,
			amountUsdc: "5,000",
			amountUsdcNum: 5000,
			txHash:
				"a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
			confirmedAt: "2026-08-28T14:32:00Z",
			network: "testnet",
		},
		{
			id: "pay_scf_infrastructure_bounty",
			eventId: "evt-stellar-community-fund-sprint",
			eventName: "SCF Community Infrastructure Sprint #45",
			prizeRank: 1,
			milestoneIndex: 0,
			amountUsdc: "3,000",
			amountUsdcNum: 3000,
			txHash:
				"8f7e6d5c4b3a2109876543210fedcba9876543210fedcba9876543210fedcba9",
			confirmedAt: "2026-08-15T18:45:00Z",
			network: "testnet",
		},
		{
			id: "pay_meridian_fast_payments_2nd",
			eventId: "evt-meridian-micropayments-bounty",
			eventName: "Meridian Fast Micropayments Track",
			prizeRank: 2,
			milestoneIndex: 1,
			amountUsdc: "2,500",
			amountUsdcNum: 2500,
			txHash:
				"4c5d6e7f8a9b0123456789abcdef0123456789abcdef0123456789abcdef0123",
			confirmedAt: "2026-07-20T10:15:00Z",
			network: "testnet",
		},
		{
			id: "pay_latam_anchor_track_winner",
			eventId: "evt-latam-cross-border-challenge",
			eventName: "LATAM Anchor Cross-Border Settlement Challenge",
			prizeRank: 3,
			milestoneIndex: 2,
			amountUsdc: "1,500",
			amountUsdcNum: 1500,
			txHash:
				"3b2a109876543210fedcba9876543210fedcba9876543210fedcba9876543210",
			confirmedAt: "2026-06-30T16:20:00Z",
			network: "testnet",
		},
	];
}

/**
 * Queries confirmed payout rows for the verified participant's wallet.
 * Filtered by Prize.winnerWalletId to guarantee wallet-scoped privacy.
 * Returns an empty array if unauthenticated, database unavailable, or no payouts exist.
 */
export async function getParticipantEarnings(
	walletIdOrAddress?: string | null,
): Promise<EarningsItem[]> {
	if (!walletIdOrAddress || !process.env.DATABASE_URL) {
		return [];
	}

	try {
		const { db } = await import("@/lib/db");

		const payouts = await db.payout.findMany({
			where: {
				prize: {
					OR: [
						{ winnerWalletId: walletIdOrAddress },
						{ winnerWallet: { address: walletIdOrAddress } },
					],
				},
			},
			include: {
				prize: {
					include: {
						event: true,
					},
				},
			},
			orderBy: {
				confirmedAt: "desc",
			},
		});

		if (!payouts || payouts.length === 0) {
			return [];
		}

		return payouts.map((p) => {
			const amountNum = Number(p.amountUsdc);
			const sanitizedAmount = Number.isNaN(amountNum) ? 0 : amountNum;

			return {
				id: p.id,
				eventId: p.prize.eventId,
				eventName: p.prize.event?.name ?? "Astrea Competition",
				prizeRank: p.prize.rank,
				milestoneIndex: p.prize.milestoneIndex,
				amountUsdc: sanitizedAmount.toLocaleString("en-US", {
					maximumFractionDigits: 0,
				}),
				amountUsdcNum: sanitizedAmount,
				txHash: p.txHash,
				confirmedAt: p.confirmedAt.toISOString(),
				network: "testnet",
			};
		});
	} catch (err) {
		console.warn(
			"Failed to query participant earnings, returning empty array:",
			err,
		);
		return [];
	}
}
