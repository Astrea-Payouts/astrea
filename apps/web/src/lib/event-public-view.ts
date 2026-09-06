import type { StellarNetwork } from "@/lib/explorer";

export interface PublicEventView {
	id: string;
	name: string;
	description: string | null;
	startsAt: Date | null;
	endsAt: Date | null;
	status: string;
	network: StellarNetwork;
	escrowContractId: string | null;
	totalPrizeUsdc: number;
	prizes: {
		id: string;
		rank: number;
		amountUsdc: number;
		milestoneIndex: number;
		status: string;
		releaseTxHash?: string | null;
		forwardTxHash?: string | null;
		releasedAt?: Date | null;
		paidOutAt?: Date | null;
		winnerAddress?: string | null;
	}[];
	judges: {
		id: string;
		walletAddress: string;
		status: string;
	}[];
	resolver: {
		name: string;
		isDefault: boolean;
	};
	organizerWalletAddress: string;
}

export interface RawPrizeInput {
	id: string;
	rank: number;
	amountUsdc: number | string | { toString(): string };
	milestoneIndex?: number | null;
	status: string;
	releaseTxHash?: string | null;
	forwardTxHash?: string | null;
	releasedAt?: Date | string | null;
	paidOutAt?: Date | string | null;
	winnerWallet?: { address: string } | null;
}

export interface RawJudgeInput {
	id: string;
	walletAddress: string;
	status: string;
}

export interface RawEventInput {
	id: string;
	name: string;
	description?: string | null;
	startsAt?: Date | string | null;
	endsAt?: Date | string | null;
	status: string;
	network?: string | null;
	escrowContractId?: string | null;
	organizerWallet?: { address: string } | null;
	prizes?: RawPrizeInput[];
	judges?: RawJudgeInput[];
}

export function sanitizePublicEvent(rawEvent: RawEventInput): PublicEventView {
	if (!rawEvent) {
		throw new Error("Event not found");
	}

	const rawPrizes = Array.isArray(rawEvent.prizes) ? rawEvent.prizes : [];
	const rawJudges = Array.isArray(rawEvent.judges) ? rawEvent.judges : [];

	const prizes = rawPrizes.map((p: RawPrizeInput) => {
		const amount =
			typeof p.amountUsdc === "number"
				? p.amountUsdc
				: p.amountUsdc
					? parseFloat(p.amountUsdc.toString())
					: 0;

		return {
			id: p.id,
			rank: p.rank,
			amountUsdc: amount,
			milestoneIndex: p.milestoneIndex ?? p.rank - 1,
			status: p.status,
			releaseTxHash: p.releaseTxHash ?? null,
			forwardTxHash: p.forwardTxHash ?? null,
			releasedAt: p.releasedAt ? new Date(p.releasedAt) : null,
			paidOutAt: p.paidOutAt ? new Date(p.paidOutAt) : null,
			winnerAddress: p.winnerWallet?.address ?? null,
		};
	});

	const totalPrizeUsdc = prizes.reduce(
		(sum: number, p: { amountUsdc: number }) => sum + p.amountUsdc,
		0,
	);

	const judges = rawJudges.map((j: RawJudgeInput) => ({
		id: j.id,
		walletAddress: j.walletAddress,
		status: j.status,
	}));

	const network: StellarNetwork =
		rawEvent.network === "MAINNET" ? "mainnet" : "testnet";

	return {
		id: rawEvent.id,
		name: rawEvent.name,
		description: rawEvent.description ?? null,
		startsAt: rawEvent.startsAt ? new Date(rawEvent.startsAt) : null,
		endsAt: rawEvent.endsAt ? new Date(rawEvent.endsAt) : null,
		status: rawEvent.status,
		network,
		escrowContractId: rawEvent.escrowContractId ?? null,
		totalPrizeUsdc,
		prizes,
		judges,
		resolver: {
			name: "Astrea (default)",
			isDefault: true,
		},
		organizerWalletAddress: rawEvent.organizerWallet?.address ?? "",
	};
}

export async function getPublicEventById(
	id: string,
): Promise<PublicEventView | null> {
	if (!id || !process.env.DATABASE_URL) {
		return null;
	}

	try {
		const { db } = await import("@/lib/db");
		const rawEvent = await db.event.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				description: true,
				startsAt: true,
				endsAt: true,
				status: true,
				network: true,
				escrowContractId: true,
				organizerWallet: {
					select: {
						address: true,
					},
				},
				prizes: {
					select: {
						id: true,
						rank: true,
						amountUsdc: true,
						milestoneIndex: true,
						status: true,
						releaseTxHash: true,
						forwardTxHash: true,
						releasedAt: true,
						paidOutAt: true,
						winnerWallet: {
							select: {
								address: true,
							},
						},
					},
					orderBy: {
						rank: "asc",
					},
				},
				judges: {
					select: {
						id: true,
						walletAddress: true,
						status: true,
					},
				},
			},
		});

		if (!rawEvent) {
			return null;
		}

		return sanitizePublicEvent(rawEvent);
	} catch (error) {
		console.error(`Failed to fetch public event with ID ${id}:`, error);
		return null;
	}
}
