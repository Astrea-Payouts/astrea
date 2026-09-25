"use client";

import { ThemedBorderGlow } from "@/components/marketing/themed-border-glow";
import { TxHashLink } from "@/components/tx-hash-link";
import type { PublicPrizeView, PublicTeamView } from "@/lib/events/public-view";
import type { StellarNetwork } from "@/lib/explorer";

export interface PrizeListProps {
	prizes: PublicPrizeView[];
	teams: PublicTeamView[];
	assetSymbol: string;
	network?: StellarNetwork;
	labels: {
		title: string;
		none: string;
		formatRank: (rank: number) => string;
		formatWinner: (teamName: string) => string;
		paidTx: string;
	};
}

/**
 * Renders the public event's prize/milestone cards wrapped in `ThemedBorderGlow`.
 * Uses a touch-capture wrapper so `border-glow.tsx` stays an untouched port of React Bits
 * while touch devices (`pointerType === "touch"`) rest in their static-border state.
 */
export function PrizeList({
	prizes,
	teams,
	assetSymbol,
	network = "testnet",
	labels,
}: PrizeListProps) {
	const stopTouchGlowChase = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType === "touch") {
			e.stopPropagation();
		}
	};

	return (
		<section className="flex flex-col gap-3" data-testid="prize-list-section">
			<h2 className="text-lg font-bold">{labels.title}</h2>
			{prizes.length === 0 ? (
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					{labels.none}
				</p>
			) : (
				<ul className="grid grid-cols-1 gap-3">
					{prizes.map((prize) => {
						const winner = prize.winnerTeamId
							? teams.find((team) => team.id === prize.winnerTeamId)
							: null;
						return (
							<li key={prize.id} className="list-none">
								<div
									data-border-glow=""
									onPointerEnter={stopTouchGlowChase}
									onPointerMove={stopTouchGlowChase}
								>
									<ThemedBorderGlow
										borderRadius={16}
										className="w-full rounded-2xl transition-colors"
									>
										<div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-sm">
											<span className="font-semibold">
												{labels.formatRank(prize.rank)}
											</span>
											<span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
												{prize.amount.toString()} {assetSymbol}
											</span>
											{winner ? (
												<span className="w-full text-xs text-zinc-600 dark:text-zinc-400">
													{labels.formatWinner(winner.name)}
												</span>
											) : null}
											{prize.releaseTxHash ? (
												<div className="flex w-full flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
													<span>{labels.paidTx}:</span>
													<TxHashLink
														hash={prize.releaseTxHash}
														network={network}
														leadingChars={8}
														trailingChars={8}
													/>
												</div>
											) : null}
										</div>
									</ThemedBorderGlow>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
