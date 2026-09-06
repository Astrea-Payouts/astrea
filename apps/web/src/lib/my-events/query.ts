import { db } from "@/lib/db";
import { calculateNextDeadline } from "./deadline";
import type { EventRole, MyEventItem } from "./types";

/**
 * Seeded sample events for local testing and standalone demonstration.
 * When DB has no events for this wallet, returns these sample items matching the wallet.
 */
export function getSampleEvents(_walletAddress: string): MyEventItem[] {
	const now = new Date();
	const liveEnd = new Date(
		now.getTime() + (2 * 86400 + 14 * 3600 + 32 * 60) * 1000,
	); // 2d 14h 32m
	const judgingEnd = new Date(now.getTime() + (18 * 3600 + 45 * 60) * 1000); // 18h 45m (urgent)
	const startFuture = new Date(now.getTime() + (5 * 86400 + 6 * 3600) * 1000); // 5d 6h
	const completedEnd = new Date(now.getTime() - 12 * 86400 * 1000);

	return [
		{
			id: "evt-soroban-hackathon-2026",
			name: "Soroban DeFi & Smart Contracts Hackathon",
			description:
				"Build the next wave of non-custodial decentralized finance primitives, AMMs, and automated escrow tools on Stellar Soroban.",
			status: "LIVE",
			startsAt: new Date(now.getTime() - 10 * 86400 * 1000).toISOString(),
			endsAt: liveEnd.toISOString(),
			judgingDeadline: new Date(
				liveEnd.getTime() + 7 * 86400 * 1000,
			).toISOString(),
			totalPrizeUsdc: "15,000",
			roles: ["PARTICIPANT"],
			nextDeadline: calculateNextDeadline({
				startsAt: new Date(now.getTime() - 10 * 86400 * 1000),
				endsAt: liveEnd,
				status: "LIVE",
				roles: ["PARTICIPANT"],
				referenceDate: now,
			}),
			submissionCount: 42,
			participantCount: 118,
			escrowContractId: "CCXYZ...SOROBAN1",
		},
		{
			id: "evt-meridian-micropayments-bounty",
			name: "Meridian Fast Micropayments Track",
			description:
				"Evaluation and scoring track for high-throughput zero-gas streaming payment SDK integrations.",
			status: "JUDGING",
			startsAt: new Date(now.getTime() - 14 * 86400 * 1000).toISOString(),
			endsAt: new Date(now.getTime() - 2 * 86400 * 1000).toISOString(),
			judgingDeadline: judgingEnd.toISOString(),
			totalPrizeUsdc: "7,500",
			roles: ["JUDGE"],
			nextDeadline: calculateNextDeadline({
				startsAt: new Date(now.getTime() - 14 * 86400 * 1000),
				endsAt: new Date(now.getTime() - 2 * 86400 * 1000),
				judgingDeadline: judgingEnd,
				status: "JUDGING",
				roles: ["JUDGE"],
				referenceDate: now,
			}),
			submissionCount: 19,
			participantCount: 45,
			escrowContractId: "CCXYZ...MERIDIAN2",
		},
		{
			id: "evt-stellar-community-fund-sprint",
			name: "SCF Community Infrastructure Sprint #46",
			description:
				"Developer tools, indexers, and mobile wallet bridges competing for SCF verified escrow allocations.",
			status: "FUNDED",
			startsAt: startFuture.toISOString(),
			endsAt: new Date(startFuture.getTime() + 14 * 86400 * 1000).toISOString(),
			judgingDeadline: new Date(
				startFuture.getTime() + 21 * 86400 * 1000,
			).toISOString(),
			totalPrizeUsdc: "25,000",
			roles: ["ORGANIZER"],
			nextDeadline: calculateNextDeadline({
				startsAt: startFuture,
				endsAt: new Date(startFuture.getTime() + 14 * 86400 * 1000),
				status: "FUNDED",
				roles: ["ORGANIZER"],
				referenceDate: now,
			}),
			submissionCount: 0,
			participantCount: 84,
			escrowContractId: "CCXYZ...SCFAWARD3",
		},
		{
			id: "evt-latam-cross-border-challenge",
			name: "LATAM Anchor Cross-Border Settlement Challenge",
			description:
				"Multi-currency on/off ramp integrations leveraging SEP-24 and Soroban automated release payouts.",
			status: "COMPLETED",
			startsAt: new Date(now.getTime() - 40 * 86400 * 1000).toISOString(),
			endsAt: completedEnd.toISOString(),
			judgingDeadline: new Date(
				completedEnd.getTime() + 7 * 86400 * 1000,
			).toISOString(),
			totalPrizeUsdc: "10,000",
			roles: ["PARTICIPANT"],
			nextDeadline: calculateNextDeadline({
				startsAt: new Date(now.getTime() - 40 * 86400 * 1000),
				endsAt: completedEnd,
				status: "COMPLETED",
				roles: ["PARTICIPANT"],
				referenceDate: now,
			}),
			submissionCount: 28,
			participantCount: 76,
			escrowContractId: "CCXYZ...LATAM4",
		},
	];
}

/**
 * Queries events for a given wallet address from Prisma DB.
 * Falls back to seeded sample events if DB yields 0 rows or is offline.
 */
export async function getMyEvents(
	walletAddress: string,
): Promise<MyEventItem[]> {
	if (!walletAddress) {
		return [];
	}

	try {
		const rawEvents = await db.event.findMany({
			where: {
				OR: [
					{ organizerWallet: { address: walletAddress } },
					{ judges: { some: { walletAddress, status: "ACTIVE" } } },
					{
						submissions: {
							some: { participantWallet: { address: walletAddress } },
						},
					},
				],
			},
			include: {
				organizerWallet: true,
				judges: true,
				submissions: {
					include: {
						participantWallet: true,
					},
				},
				prizes: true,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		if (rawEvents.length === 0) {
			return getSampleEvents(walletAddress);
		}

		const now = new Date();

		return rawEvents.map((evt) => {
			const roles: EventRole[] = [];
			if (evt.organizerWallet?.address === walletAddress) {
				roles.push("ORGANIZER");
			}
			if (
				evt.judges.some(
					(j) => j.walletAddress === walletAddress && j.status === "ACTIVE",
				)
			) {
				roles.push("JUDGE");
			}
			if (
				evt.submissions.some(
					(s) => s.participantWallet?.address === walletAddress,
				)
			) {
				roles.push("PARTICIPANT");
			}

			// If no direct link found but returned, default to PARTICIPANT
			if (roles.length === 0) {
				roles.push("PARTICIPANT");
			}

			const prizeSum = evt.prizes.reduce((sum, p) => {
				const num = Number(p.amountUsdc);
				return sum + (Number.isNaN(num) ? 0 : num);
			}, 0);

			const nextDeadline = calculateNextDeadline({
				startsAt: evt.startsAt,
				endsAt: evt.endsAt,
				status: evt.status,
				roles,
				referenceDate: now,
			});

			return {
				id: evt.id,
				name: evt.name,
				description: evt.description,
				status: evt.status as MyEventItem["status"],
				startsAt: evt.startsAt ? evt.startsAt.toISOString() : null,
				endsAt: evt.endsAt ? evt.endsAt.toISOString() : null,
				judgingDeadline: null,
				totalPrizeUsdc: prizeSum.toLocaleString("en-US", {
					maximumFractionDigits: 0,
				}),
				roles,
				nextDeadline,
				submissionCount: evt.submissions.length,
				participantCount: evt.submissions.length,
				escrowContractId: evt.escrowContractId,
			};
		});
	} catch (err) {
		console.warn("Prisma query failed, serving mock sample events:", err);
		return getSampleEvents(walletAddress);
	}
}
