import { TxHashLink } from "@/components/tx-hash-link";
import type { PublicPrizeView, PublicTeamView } from "@/lib/events/public-view";
import type { StellarNetwork } from "@/lib/explorer";

export interface PayoutHistoryProps {
	prizes: PublicPrizeView[];
	teams: PublicTeamView[];
	assetSymbol: string;
	network?: StellarNetwork;
	labels: {
		title: string;
		empty: string;
		formatRank: (rank: number) => string;
		unassignedWinner: string;
		txProof: string;
		releasePending?: string;
	};
}

export type PayoutRowState = "confirmed" | "pending" | "hidden";

/**
 * Pure eligibility rule for public payout history:
 * - A prize is 'confirmed' (paid) ONLY when it has an on-chain release transaction hash.
 * - A prize with a released/paid status but no release transaction hash is 'pending' confirmation.
 * - Non-released prizes are 'hidden' and never appear in the public payout history.
 */
export function getPayoutRowState(
	prize: Pick<PublicPrizeView, "status" | "releaseTxHash">
): PayoutRowState {
	if (prize.releaseTxHash) {
		return "confirmed";
	}

	const isReleasedStatus =
		prize.status === "RELEASED" || prize.status === "PAID_OUT";

	if (isReleasedStatus) {
		return "pending";
	}

	return "hidden";
}

/**
 * Renders the payout history table:
 * - Verified on-chain releases show the explorer TxHashLink.
 * - Released prizes without an on-chain release tx hash show an honest pending confirmation badge.
 * - Non-released prizes are excluded entirely.
 */
export function PayoutHistory({
	prizes,
	teams,
	assetSymbol,
	network = "testnet",
	labels,
}: PayoutHistoryProps) {
	const visiblePrizes = prizes
		.map((prize) => ({
			prize,
			state: getPayoutRowState(prize),
		}))
		.filter((item) => item.state !== "hidden");

	if (visiblePrizes.length === 0) {
		return null;
	}

	return (
		<section
			data-testid="payout-history-section"
			className="flex flex-col gap-3"
		>
			<h2 className="text-lg font-bold">{labels.title}</h2>
			<div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-zinc-50/40 dark:divide-white/10 dark:border-white/10 dark:bg-zinc-900/40">
				{visiblePrizes.map(({ prize, state }) => {
					const winner = prize.winnerTeamId
						? teams.find((t) => t.id === prize.winnerTeamId)
						: null;
					return (
						<div
							key={prize.id}
							data-testid={`payout-history-row-${prize.rank}`}
							className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
						>
							<div className="flex items-center gap-3">
								<span className="font-semibold">
									{labels.formatRank(prize.rank)}
								</span>
								<span className="text-zinc-700 dark:text-zinc-300">
									{winner ? winner.name : labels.unassignedWinner}
								</span>
							</div>
							<div className="flex flex-wrap items-center gap-4">
								<span className="font-mono font-medium text-emerald-700 dark:text-emerald-300">
									{prize.amount.toString()} {assetSymbol}
								</span>
								{state === "confirmed" && prize.releaseTxHash ? (
									<div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
										<span>{labels.txProof}:</span>
										<TxHashLink
											hash={prize.releaseTxHash}
											network={network}
											leadingChars={6}
											trailingChars={6}
										/>
									</div>
								) : (
									<span
										data-testid={`payout-history-pending-${prize.rank}`}
										className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
									>
										{labels.releasePending ?? "Release pending confirmation"}
									</span>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
