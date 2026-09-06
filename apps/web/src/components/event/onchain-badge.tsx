import { ExternalLink, ShieldCheck } from "lucide-react";
import {
	getExplorerContractUrl,
	type StellarNetwork,
	truncateHash,
} from "@/lib/explorer";
import { cn } from "@/lib/utils";

export interface OnchainBadgeProps {
	contractId?: string | null;
	network?: StellarNetwork;
	className?: string;
	showContractLink?: boolean;
}

export function OnchainBadge({
	contractId,
	network = "testnet",
	className,
	showContractLink = true,
}: OnchainBadgeProps) {
	if (!contractId) {
		return null;
	}

	const contractUrl = getExplorerContractUrl(contractId, network);
	const truncatedContract = truncateHash(contractId, 4, 4);

	return (
		<div
			className={cn(
				"inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-400",
				className,
			)}
			data-testid="onchain-badge"
		>
			<span className="inline-flex items-center gap-1.5">
				<ShieldCheck
					className="h-4 w-4 text-emerald-400 shrink-0"
					aria-hidden="true"
				/>
				<span>Prizes verified on-chain</span>
			</span>

			{showContractLink && (
				<>
					<span className="text-emerald-500/40" aria-hidden="true">
						•
					</span>
					<a
						href={contractUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 font-mono text-emerald-300/80 transition-colors hover:text-emerald-200 hover:underline"
						title={`View contract on Stellar Expert: ${contractId}`}
						aria-label={`View contract ${contractId} on Stellar Expert`}
					>
						<span>{truncatedContract}</span>
						<ExternalLink
							className="h-3 w-3 shrink-0 opacity-70"
							aria-hidden="true"
						/>
					</a>
				</>
			)}
		</div>
	);
}
