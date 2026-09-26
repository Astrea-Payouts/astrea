import { db } from "@/lib/db";

/**
 * Explicit Prisma select projection for public event views (U03 / docs/architecture.md).
 * Ensures private fields (such as Wallet.email, Wallet.userId, or User records)
 * are never fetched or exposed to unauthenticated visitors.
 */
export const PUBLIC_EVENT_SELECT = {
	id: true,
	name: true,
	description: true,
	logoUrl: true,
	tagline: true,
	location: true,
	timezone: true,
	registrationOpensAt: true,
	registrationClosesAt: true,
	startsAt: true,
	endsAt: true,
	judgingDeadlineAt: true,
	status: true,
	requireGithub: true,
	network: true,
	escrowEventId: true,
	organizerWalletId: true,
	organizerWallet: {
		select: {
			id: true,
			address: true,
		},
	},
	prizes: {
		orderBy: { rank: "asc" as const },
		select: {
			id: true,
			rank: true,
			amount: true,
			status: true,
			winnerTeamId: true,
			releaseTxHash: true,
			releasedAt: true,
		},
	},
	judges: {
		where: { status: "ACTIVE" as const },
		select: {
			id: true,
			walletAddress: true,
			displayName: true,
			status: true,
		},
	},
	teams: {
		orderBy: { createdAt: "asc" as const },
		select: {
			id: true,
			name: true,
			submissionUrl: true,
			submissionVerifiedAt: true,
			members: {
				orderBy: { ordinal: "asc" as const },
				select: {
					walletId: true,
					ordinal: true,
					shareBasisPoints: true,
					wallet: {
						select: {
							id: true,
							address: true,
						},
					},
				},
			},
		},
	},
} as const;

export interface PublicPrizeView {
	id: string;
	rank: number;
	amount: { toString(): string } | string | number;
	status?: string;
	winnerTeamId: string | null;
	releaseTxHash: string | null;
	releasedAt?: Date | string | null;
}

export interface PublicJudgeView {
	id: string;
	walletAddress: string;
	displayName: string;
	status?: string;
}

export interface PublicTeamMemberView {
	walletId: string;
	ordinal: number;
	shareBasisPoints?: number;
	wallet: {
		id: string;
		address: string;
	};
}

export interface PublicTeamView {
	id: string;
	name: string;
	submissionUrl?: string;
	submissionVerifiedAt?: Date | string | null;
	members: PublicTeamMemberView[];
}

export interface PublicEventView {
	id: string;
	name: string;
	description: string | null;
	logoUrl?: string | null;
	tagline?: string | null;
	location?: string | null;
	timezone?: string;
	registrationOpensAt?: Date | string | null;
	registrationClosesAt?: Date | string | null;
	startsAt?: Date | string | null;
	endsAt?: Date | string | null;
	judgingDeadlineAt?: Date | string | null;
	status:
		| "DRAFT"
		| "CREATED"
		| "LIVE"
		| "JUDGING"
		| "COMPLETED"
		| "DISPUTED"
		| "CANCELLED";
	requireGithub?: boolean;
	network?: "TESTNET" | "MAINNET";
	escrowEventId: string | null;
	organizerWalletId: string;
	organizerWallet: {
		id: string;
		address: string;
	};
	prizes: PublicPrizeView[];
	judges: PublicJudgeView[];
	teams: PublicTeamView[];
}

/**
 * Strips any private or sensitive fields from an arbitrary event record,
 * returning strictly the whitelisted PublicEventView representation.
 */
export function sanitizePublicEventView(
	raw: Record<string, unknown> & {
		id: string;
		name: string;
		status: PublicEventView["status"];
		organizerWalletId: string;
		organizerWallet: { id: string; address: string };
	},
): PublicEventView {
	const rawPrizes = Array.isArray(raw.prizes) ? raw.prizes : [];
	const rawJudges = Array.isArray(raw.judges) ? raw.judges : [];
	const rawTeams = Array.isArray(raw.teams) ? raw.teams : [];

	return {
		id: String(raw.id),
		name: String(raw.name),
		description: typeof raw.description === "string" ? raw.description : null,
		logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : null,
		tagline: typeof raw.tagline === "string" ? raw.tagline : null,
		location: typeof raw.location === "string" ? raw.location : null,
		timezone: typeof raw.timezone === "string" ? raw.timezone : "UTC",
		registrationOpensAt:
			(raw.registrationOpensAt as Date | string | null) ?? null,
		registrationClosesAt:
			(raw.registrationClosesAt as Date | string | null) ?? null,
		startsAt: (raw.startsAt as Date | string | null) ?? null,
		endsAt: (raw.endsAt as Date | string | null) ?? null,
		judgingDeadlineAt: (raw.judgingDeadlineAt as Date | string | null) ?? null,
		status: raw.status,
		requireGithub: Boolean(raw.requireGithub),
		network: raw.network === "MAINNET" ? "MAINNET" : "TESTNET",
		escrowEventId:
			typeof raw.escrowEventId === "string" ? raw.escrowEventId : null,
		organizerWalletId: String(raw.organizerWalletId),
		organizerWallet: {
			id: String(raw.organizerWallet.id),
			address: String(raw.organizerWallet.address),
		},
		prizes: rawPrizes.map((p: Record<string, unknown>) => ({
			id: String(p.id),
			rank: Number(p.rank),
			amount: p.amount as PublicPrizeView["amount"],
			status: typeof p.status === "string" ? p.status : "PENDING",
			winnerTeamId: typeof p.winnerTeamId === "string" ? p.winnerTeamId : null,
			releaseTxHash:
				typeof p.releaseTxHash === "string" ? p.releaseTxHash : null,
			releasedAt: (p.releasedAt as Date | string | null) ?? null,
		})),
		judges: rawJudges.map((j: Record<string, unknown>) => ({
			id: String(j.id),
			walletAddress: String(j.walletAddress),
			displayName: String(j.displayName),
			status: typeof j.status === "string" ? j.status : "ACTIVE",
		})),
		teams: rawTeams.map((t: Record<string, unknown>) => {
			const members = Array.isArray(t.members) ? t.members : [];
			return {
				id: String(t.id),
				name: String(t.name),
				submissionUrl:
					typeof t.submissionUrl === "string" ? t.submissionUrl : undefined,
				submissionVerifiedAt:
					(t.submissionVerifiedAt as Date | string | null) ?? null,
				members: members.map((m: Record<string, unknown>) => {
					const wallet = (m.wallet ?? {}) as Record<string, unknown>;
					return {
						walletId: String(m.walletId),
						ordinal: Number(m.ordinal ?? 1),
						shareBasisPoints:
							typeof m.shareBasisPoints === "number"
								? m.shareBasisPoints
								: undefined,
						wallet: {
							id: String(wallet.id ?? m.walletId),
							address: String(wallet.address ?? ""),
						},
					};
				}),
			};
		}),
	};
}

/**
 * Resolves the dispute resolver display metadata per ADR-003.
 * Returns the default Astrea resolver state when no custom resolver address was named.
 */
export function resolveDisputeResolver(
	customResolverAddress?: string | null,
	defaultLabel = "Astrea (default)",
): { isDefault: boolean; label: string; address: string | null } {
	if (customResolverAddress && customResolverAddress.trim().length > 0) {
		return {
			isDefault: false,
			label: customResolverAddress.trim(),
			address: customResolverAddress.trim(),
		};
	}
	return {
		isDefault: true,
		label: defaultLabel,
		address: null,
	};
}

/**
 * Loads an event through the row-level public view projection, returning only public fields.
 */
export async function loadPublicEventView(
	id: string,
): Promise<PublicEventView | null> {
	const raw = await db.event.findUnique({
		where: { id },
		select: PUBLIC_EVENT_SELECT,
	});
	if (!raw) return null;
	return sanitizePublicEventView(
		raw as unknown as Parameters<typeof sanitizePublicEventView>[0],
	);
}
