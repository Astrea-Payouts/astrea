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
	};
}

/**
 * Renders the payout history table for prizes that have reached RELEASED state
 * (or carry a confirmed on-chain release transaction hash).
 */
export function PayoutHistory({
	prizes,
	teams,
	assetSymbol,
	network = "testnet",
	labels,
}: PayoutHistoryProps) {
	const releasedPrizes = prizes.filter(
		(prize) =>
			prize.status === "RELEASED" ||
			prize.status === "PAID_OUT" ||
			Boolean(prize.releaseTxHash),
	);

	if (releasedPrizes.length === 0) {
		return null;
	}

	return (
		<section
			data-testid="payout-history-section"
			className="flex flex-col gap-3"
		>
			<h2 className="text-lg font-bold">{labels.title}</h2>
			<div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-zinc-50/40 dark:divide-white/10 dark:border-white/10 dark:bg-zinc-900/40">
				{releasedPrizes.map((prize) => {
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
								{prize.releaseTxHash ? (
									<div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
										<span>{labels.txProof}:</span>
										<TxHashLink
											hash={prize.releaseTxHash}
											network={network}
											leadingChars={6}
											trailingChars={6}
										/>
									</div>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
