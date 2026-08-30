"use client";

import { useTranslations } from "next-intl";
import { BorderGlow } from "@/components/border-glow";
import { TxHashLink } from "@/components/tx-hash-link";
import type { StellarNetwork } from "@/lib/explorer";
import type { PublicPrize } from "@/lib/queries/public-event";

export interface PrizeListProps {
	prizes: PublicPrize[];
	network: StellarNetwork;
}

export function PrizeList({ prizes, network }: PrizeListProps) {
	const t = useTranslations("PublicEventPage");

	if (prizes.length === 0) {
		return <p className="text-sm text-muted-foreground">{t("noPrizes")}</p>;
	}

	return (
		<ul className="grid gap-4">
			{prizes.map((prize) => (
				<li key={prize.id}>
					<BorderGlow>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									{t("prizeRank", { rank: prize.rank })}
								</p>
								<p className="text-lg font-semibold text-foreground">
									{t("prizeAmount", { amount: prize.amountUsdc })}
								</p>
								<p className="text-sm text-muted-foreground">
									{t(`prizeStatus.${prize.status}`)}
								</p>
							</div>
							{prize.winnerAddress ? (
								<p className="font-mono text-xs text-muted-foreground">
									{t("winner")}: {prize.winnerAddress.slice(0, 4)}…
									{prize.winnerAddress.slice(-4)}
								</p>
							) : null}
						</div>
						{prize.releaseTxHash ? (
							<div className="mt-3">
								<p className="mb-1 text-xs text-muted-foreground">
									{t("releaseTx")}
								</p>
								<TxHashLink hash={prize.releaseTxHash} network={network} />
							</div>
						) : null}
					</BorderGlow>
				</li>
			))}
		</ul>
	);
}
