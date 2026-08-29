"use server";

import { db } from "@/lib/db";
import {
	calculateEarningsSummary,
	DEMO_PARTICIPANT_EARNINGS,
	type EarningsSummary,
	type ParticipantEarningsItem,
} from "@/lib/earnings";
import { getSessionWallet } from "@/lib/wallet/session";

export async function getParticipantEarningsByWalletId(
	walletId: string,
): Promise<ParticipantEarningsItem[]> {
	try {
		const payouts = await db.payout.findMany({
			where: {
				prize: {
					winnerWalletId: walletId,
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

		return payouts.map((p) => {
			const numericAmount = Number(p.amountUsdc);
			return {
				id: p.id,
				txHash: p.txHash,
				amountUsdc: numericAmount,
				amountFormatted: numericAmount.toLocaleString("en-US", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				}),
				confirmedAt: p.confirmedAt.toISOString(),
				eventName: p.prize.event.name,
				eventId: p.prize.event.id,
				prizeRank: p.prize.rank,
				network: p.prize.event.network === "MAINNET" ? "mainnet" : "testnet",
			};
		});
	} catch (err) {
		console.error("Failed to query participant earnings from database:", err);
		return [];
	}
}

export async function getSessionEarningsAction(): Promise<{
	walletAddress: string | null;
	earnings: ParticipantEarningsItem[];
	summary: EarningsSummary;
}> {
	try {
		const wallet = await getSessionWallet();
		if (!wallet) {
			return {
				walletAddress: null,
				earnings: DEMO_PARTICIPANT_EARNINGS,
				summary: calculateEarningsSummary(DEMO_PARTICIPANT_EARNINGS),
			};
		}

		const earnings = await getParticipantEarningsByWalletId(wallet.id);
		return {
			walletAddress: wallet.address,
			earnings,
			summary: calculateEarningsSummary(earnings),
		};
	} catch (_err) {
		return {
			walletAddress: null,
			earnings: DEMO_PARTICIPANT_EARNINGS,
			summary: calculateEarningsSummary(DEMO_PARTICIPANT_EARNINGS),
		};
	}
}
