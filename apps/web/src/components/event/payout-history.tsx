"use client";

import { useTranslations } from "next-intl";
import { TxHashLink } from "@/components/tx-hash-link";
import type { StellarNetwork } from "@/lib/explorer";
import type { PublicPrize } from "@/lib/queries/public-event";

export interface PayoutHistoryProps {
	prizes: PublicPrize[];
	network: StellarNetwork;
}

export function PayoutHistory({ prizes, network }: PayoutHistoryProps) {
	const t = useTranslations("PublicEventPage");

	const released = prizes.flatMap((prize) =>
		prize.payouts.map((payout) => ({
			prizeRank: prize.rank,
			...payout,
		})),
	);

	if (released.length === 0) {
		return <p className="text-sm text-muted-foreground">{t("noPayoutsYet")}</p>;
	}

	return (
		<ul className="space-y-3">
			{released.map((entry) => (
				<li
					key={entry.txHash}
					className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
				>
					<div>
						<p className="text-sm font-medium">
							{t("payoutForRank", { rank: entry.prizeRank })}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("prizeAmount", { amount: entry.amountUsdc })}
						</p>
					</div>
					<TxHashLink hash={entry.txHash} network={network} />
				</li>
			))}
		</ul>
	);
}
