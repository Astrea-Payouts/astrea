"use client";

import { BadgeCheck, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	getExplorerContractUrl,
	type StellarNetwork,
	truncateHash,
} from "@/lib/explorer";

export interface OnChainBadgeProps {
	contractId: string;
	network?: StellarNetwork;
}

export function OnChainBadge({
	contractId,
	network = "testnet",
}: OnChainBadgeProps) {
	const t = useTranslations("PublicEventPage");
	const explorerUrl = getExplorerContractUrl(contractId, network);

	return (
		<div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100">
			<BadgeCheck className="size-4 shrink-0" aria-hidden />
			<span>{t("verifiedBadge")}</span>
			<a
				href={explorerUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-1 font-mono text-emerald-50 underline-offset-4 hover:underline"
			>
				{truncateHash(contractId, 6, 6)}
				<ExternalLink className="size-3.5 opacity-80" aria-hidden />
			</a>
		</div>
	);
}
