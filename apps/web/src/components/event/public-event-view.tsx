"use client";

import { useFormatter, useTranslations } from "next-intl";
import { JudgesPanel } from "@/components/event/judges-panel";
import { OnChainBadge } from "@/components/event/on-chain-badge";
import { PayoutHistory } from "@/components/event/payout-history";
import { PrizeList } from "@/components/event/prize-list";
import type { PublicEvent } from "@/lib/queries/public-event";
import { toExplorerNetwork } from "@/lib/queries/public-event";

export interface PublicEventViewProps {
	event: PublicEvent;
}

export function PublicEventView({ event }: PublicEventViewProps) {
	const t = useTranslations("PublicEventPage");
	const format = useFormatter();
	const network = toExplorerNetwork(event.network);

	const dateRange =
		event.startsAt && event.endsAt
			? t("dateRange", {
					start: format.dateTime(event.startsAt, { dateStyle: "medium" }),
					end: format.dateTime(event.endsAt, { dateStyle: "medium" }),
				})
			: null;

	return (
		<article className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16 md:px-12">
			<header className="space-y-4">
				<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
					{t(`eventStatus.${event.status}`)}
				</p>
				<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
					{event.name}
				</h1>
				{event.description ? (
					<p className="text-base text-muted-foreground">{event.description}</p>
				) : null}
				{dateRange ? (
					<p className="text-sm text-muted-foreground">{dateRange}</p>
				) : null}
				<p className="text-sm text-muted-foreground">
					{t("totalPrizePool", { amount: event.totalPrizeUsdc })}
				</p>
				{event.escrowContractId ? (
					<OnChainBadge contractId={event.escrowContractId} network={network} />
				) : null}
			</header>

			<section className="space-y-4">
				<h2 className="text-lg font-semibold">{t("prizesHeading")}</h2>
				<PrizeList prizes={event.prizes} network={network} />
			</section>

			<JudgesPanel judges={event.judges} />

			<section className="space-y-4">
				<h2 className="text-lg font-semibold">{t("payoutHistoryHeading")}</h2>
				<PayoutHistory prizes={event.prizes} network={network} />
			</section>
		</article>
	);
}
