import { formatSmallestUnits, truncateHash } from "../explorer";

export type EventCardStatus =
	| "DRAFT"
	| "CREATED"
	| "FUNDED"
	| "LIVE"
	| "JUDGING"
	| "COMPLETED"
	| "DISPUTED"
	| "CANCELLED";

export type CardTemplateType = "open" | "winners" | "generic";

export interface CardWinner {
	rank: number;
	teamName: string;
	members: string[];
	amount: string;
	asset: string;
	txHash: string | null;
}

export interface EventCardModel {
	id: string;
	name: string;
	locale: string;
	status: EventCardStatus;
	organizer: string;
	judges: string[];
	prizePool: {
		amount: string;
		asset: string;
	};
	judgingDeadlineAt: string | null;
	formattedDeadline: string | null;
	registrationClosesAt: string | null;
	isRegistrationClosed: boolean;
	teamsRegistered: number;
	winners: CardWinner[];
	hasVerifiableMoney: boolean;
	templateType: CardTemplateType;
}

export interface CardMemberWallet {
	address: string;
	linkedAccounts?: Array<{
		provider: string;
		username: string;
	}>;
}

export interface BuildCardModelInput {
	event: {
		id: string;
		name: string;
		status: EventCardStatus;
		organizerWallet: { address: string };
		judges: Array<{ displayName: string; walletAddress: string }>;
		teams: Array<{
			id: string;
			name: string;
			members: Array<{
				wallet: CardMemberWallet;
			}>;
		}>;
		prizes: Array<{
			id?: string;
			rank: number;
			amount: { toString(): string } | string | number;
			winnerTeamId: string | null;
			releaseTxHash: string | null;
		}>;
		judgingDeadlineAt?: Date | string | null;
		registrationClosesAt?: Date | string | null;
	};
	escrow: {
		reward: bigint | string | number;
		state: string;
	} | null;
	locale?: string;
	assetSymbol?: string;
	now?: Date;
}

export function formatCardDate(
	isoString: string | null | undefined,
	locale = "en",
): string | null {
	if (!isoString) return null;
	try {
		const date = new Date(isoString);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC",
		}).format(date);
	} catch {
		return null;
	}
}

export function truncateText(text: string, maxLength: number): string {
	if (!text) return "";
	if (text.length <= maxLength) return text;
	return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function truncateWallet(address: string): string {
	return truncateHash(address, 6, 6);
}

export function formatMemberHandle(wallet: CardMemberWallet): string {
	const github = wallet.linkedAccounts?.find(
		(acc) => acc.provider.toLowerCase() === "github",
	);
	if (github?.username) {
		const clean = github.username.replace(/^@/, "").trim();
		if (clean) return `@${clean}`;
	}
	return truncateWallet(wallet.address);
}

export function buildEventCardModel(
	input: BuildCardModelInput,
): EventCardModel {
	const { event, escrow, locale = "en", assetSymbol = "USDC" } = input;

	let rewardBigInt = BigInt(0);
	if (escrow?.reward != null) {
		try {
			rewardBigInt = BigInt(escrow.reward.toString());
		} catch {
			rewardBigInt = BigInt(0);
		}
	}

	const hasVerifiableMoney = Boolean(escrow && rewardBigInt > BigInt(0));

	let templateType: CardTemplateType = "generic";
	if (hasVerifiableMoney) {
		if (event.status === "LIVE" || event.status === "JUDGING") {
			templateType = "open";
		} else if (event.status === "COMPLETED") {
			templateType = "winners";
		}
	}

	const prizePoolAmount = hasVerifiableMoney
		? formatSmallestUnits(rewardBigInt.toString())
		: "0";

	const judges = event.judges.map(
		(j) => j.displayName?.trim() || truncateWallet(j.walletAddress),
	);

	const sortedPrizes = [...event.prizes].sort((a, b) => a.rank - b.rank);
	const winners: CardWinner[] = [];

	for (const prize of sortedPrizes) {
		const winnerTeam = prize.winnerTeamId
			? event.teams.find((t) => t.id === prize.winnerTeamId)
			: null;

		if (winnerTeam) {
			const members = winnerTeam.members.map((m) =>
				formatMemberHandle(m.wallet),
			);
			winners.push({
				rank: prize.rank,
				teamName: truncateText(winnerTeam.name, 28),
				members,
				amount: prize.amount.toString(),
				asset: assetSymbol,
				txHash: prize.releaseTxHash,
			});
		}
	}

	const currentDate = input.now ?? new Date();
	const judgingDeadlineAt = event.judgingDeadlineAt
		? new Date(event.judgingDeadlineAt).toISOString()
		: null;
	const registrationClosesAt = event.registrationClosesAt
		? new Date(event.registrationClosesAt).toISOString()
		: null;
	const isRegistrationClosed = Boolean(
		registrationClosesAt && new Date(registrationClosesAt) < currentDate,
	);
	const formattedDeadline = formatCardDate(judgingDeadlineAt, locale);

	return {
		id: event.id,
		name: truncateText(event.name, 64),
		locale,
		status: event.status,
		organizer: truncateWallet(event.organizerWallet.address),
		judges,
		prizePool: {
			amount: prizePoolAmount,
			asset: assetSymbol,
		},
		judgingDeadlineAt,
		formattedDeadline,
		registrationClosesAt,
		isRegistrationClosed,
		teamsRegistered: event.teams.length,
		winners,
		hasVerifiableMoney,
		templateType,
	};
}
