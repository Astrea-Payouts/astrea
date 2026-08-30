import type {
	EventStatus,
	PrizeStatus,
	StellarNetwork,
} from "@/generated/prisma/client";

const PUBLIC_EVENT_STATUSES: EventStatus[] = [
	"CREATED",
	"FUNDED",
	"LIVE",
	"JUDGING",
	"COMPLETED",
];

export type PublicJudge = {
	displayName: string;
	walletAddress: string;
};

export type PublicPayout = {
	txHash: string;
	amountUsdc: string;
	confirmedAt: Date;
};

export type PublicPrize = {
	id: string;
	rank: number;
	amountUsdc: string;
	status: PrizeStatus;
	winnerAddress: string | null;
	releaseTxHash: string | null;
	forwardTxHash: string | null;
	payouts: PublicPayout[];
};

export type PublicEvent = {
	id: string;
	name: string;
	description: string | null;
	startsAt: Date | null;
	endsAt: Date | null;
	status: EventStatus;
	network: StellarNetwork;
	escrowContractId: string | null;
	prizes: PublicPrize[];
	judges: PublicJudge[];
	totalPrizeUsdc: string;
};

function formatUsdc(value: { toString(): string }): string {
	return value.toString();
}

function sumPrizeAmounts(
	prizes: Array<{ amountUsdc: { toString(): string } }>,
): string {
	const total = prizes.reduce(
		(sum, prize) => sum + Number.parseFloat(prize.amountUsdc.toString()),
		0,
	);
	return total.toFixed(7);
}

/** Public read model — only fields safe to expose without auth. */
export async function getPublicEventById(
	id: string,
): Promise<PublicEvent | null> {
	const { db } = await import("@/lib/db");
	const event = await db.event.findFirst({
		where: {
			id,
			status: { in: PUBLIC_EVENT_STATUSES },
		},
		select: {
			id: true,
			name: true,
			description: true,
			startsAt: true,
			endsAt: true,
			status: true,
			network: true,
			escrowContractId: true,
			judges: {
				where: { status: "ACTIVE" },
				select: {
					displayName: true,
					walletAddress: true,
				},
				orderBy: { createdAt: "asc" },
			},
			prizes: {
				select: {
					id: true,
					rank: true,
					amountUsdc: true,
					status: true,
					releaseTxHash: true,
					forwardTxHash: true,
					winnerWallet: {
						select: { address: true },
					},
					payouts: {
						select: {
							txHash: true,
							amountUsdc: true,
							confirmedAt: true,
						},
						orderBy: { confirmedAt: "asc" },
					},
				},
				orderBy: [{ rank: "asc" }, { milestoneIndex: "asc" }],
			},
		},
	});

	if (!event) {
		return null;
	}

	return {
		id: event.id,
		name: event.name,
		description: event.description,
		startsAt: event.startsAt,
		endsAt: event.endsAt,
		status: event.status,
		network: event.network,
		escrowContractId: event.escrowContractId,
		judges: event.judges,
		totalPrizeUsdc: sumPrizeAmounts(event.prizes),
		prizes: event.prizes.map((prize) => ({
			id: prize.id,
			rank: prize.rank,
			amountUsdc: formatUsdc(prize.amountUsdc),
			status: prize.status,
			winnerAddress: prize.winnerWallet?.address ?? null,
			releaseTxHash: prize.releaseTxHash,
			forwardTxHash: prize.forwardTxHash,
			payouts: prize.payouts.map((payout) => ({
				txHash: payout.txHash,
				amountUsdc: formatUsdc(payout.amountUsdc),
				confirmedAt: payout.confirmedAt,
			})),
		})),
	};
}

export function toExplorerNetwork(
	network: StellarNetwork,
): "testnet" | "mainnet" {
	return network === "MAINNET" ? "mainnet" : "testnet";
}
