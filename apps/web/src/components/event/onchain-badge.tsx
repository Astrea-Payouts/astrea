import { ShieldCheck } from "lucide-react";
import type { EscrowEvent } from "@/lib/escrow/read-event";
import {
	formatSmallestUnits,
	getExplorerContractUrl,
	type StellarNetwork,
} from "@/lib/explorer";

export interface OnchainBadgeProps {
	escrowEventId: string | null;
	escrow: EscrowEvent | null;
	escrowError?: string | null;
	contractId: string;
	assetSymbol: string;
	network?: StellarNetwork;
	labels: {
		title: string;
		verifiedBadge: string;
		onChainState: string;
		readFailed: string;
		eventId: string;
		contract: string;
		notOnChain: string;
	};
}

/**
 * Renders the "Prizes verified on-chain" commitment surface and shared contract explorer link.
 * Strictly gated on real `create_event` confirmation (`escrowEventId` + `escrow` read) so
 * unconfirmed or draft events never display the verified badge optimistically.
 */
export function OnchainBadge({
	escrowEventId,
	escrow,
	escrowError,
	contractId,
	assetSymbol,
	network = "testnet",
	labels,
}: OnchainBadgeProps) {
	const isConfirmedOnChain = Boolean(escrowEventId && escrow);
	const contractUrl = getExplorerContractUrl(contractId, network);

	return (
		<section
			data-testid="onchain-badge-section"
			className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-zinc-900/60"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-lg font-bold">{labels.title}</h2>
				{isConfirmedOnChain ? (
					<span
						data-testid="prizes-verified-badge"
						className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
					>
						<ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
						{labels.verifiedBadge}
					</span>
				) : null}
			</div>

			{escrowEventId ? (
				<>
					{escrow ? (
						<p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
							{formatSmallestUnits(escrow.reward)} {assetSymbol}
							<span className="ml-2 text-xs font-normal text-zinc-600 dark:text-zinc-400">
								{labels.onChainState}
							</span>
						</p>
					) : (
						<p
							className="text-sm break-words text-red-700 dark:text-red-300"
							role="alert"
						>
							{labels.readFailed}{" "}
							<code className="font-mono text-xs">{escrowError}</code>
						</p>
					)}
					<dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
						<dt className="text-zinc-600 dark:text-zinc-400">
							{labels.eventId}
						</dt>
						<dd className="font-mono text-xs break-all">{escrowEventId}</dd>
						{isConfirmedOnChain ? (
							<>
								<dt className="text-zinc-600 dark:text-zinc-400">
									{labels.contract}
								</dt>
								<dd>
									<a
										href={contractUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="font-mono text-xs break-all underline-offset-4 hover:underline"
									>
										{contractId}
									</a>
								</dd>
							</>
						) : null}
					</dl>
				</>
			) : (
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					{labels.notOnChain}
				</p>
			)}
		</section>
	);
}
