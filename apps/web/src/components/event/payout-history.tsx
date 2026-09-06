import { CheckCircle2, Clock } from "lucide-react";
import { TxHashLink } from "@/components/tx-hash-link";
import { type StellarNetwork, truncateHash } from "@/lib/explorer";
import { cn } from "@/lib/utils";

export interface PayoutHistoryItem {
	id: string;
	rank: number;
	amountUsdc: number | string;
	releaseTxHash?: string | null;
	forwardTxHash?: string | null;
	releasedAt?: string | Date | null;
	paidOutAt?: string | Date | null;
	winnerAddress?: string | null;
	status: string;
}

export interface PayoutHistoryProps {
	items: PayoutHistoryItem[];
	network?: StellarNetwork;
	className?: string;
}

function formatAmount(amount: number | string): string {
	const numeric = typeof amount === "number" ? amount : parseFloat(amount);
	if (Number.isNaN(numeric)) return String(amount);
	return `$${numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

function formatDate(dateValue?: string | Date | null): string {
	if (!dateValue) return "Pending";
	const date = new Date(dateValue);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function PayoutHistory({
	items,
	network = "testnet",
	className,
}: PayoutHistoryProps) {
	const releasedPrizes = items.filter(
		(p) =>
			(p.status === "RELEASED" || p.status === "PAID_OUT") &&
			(p.releaseTxHash || p.forwardTxHash),
	);

	if (releasedPrizes.length === 0) {
		return (
			<div
				className={cn(
					"rounded-xl border border-white/10 bg-zinc-950/60 p-8 text-center text-sm text-white/50",
					className,
				)}
				data-testid="payout-history-empty"
			>
				<Clock
					className="mx-auto mb-2 h-5 w-5 text-white/30"
					aria-hidden="true"
				/>
				<p className="font-medium text-white/70">No payouts released yet</p>
				<p className="mt-1 text-xs text-white/40">
					Payout transactions with verified on-chain proofs will appear here as
					prizes are released.
				</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 backdrop-blur-sm",
				className,
			)}
			data-testid="payout-history-table"
		>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm text-white/80">
					<thead className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold uppercase tracking-wider text-white/50">
						<tr>
							<th scope="col" className="px-5 py-3.5">
								Rank
							</th>
							<th scope="col" className="px-5 py-3.5">
								Amount
							</th>
							<th scope="col" className="px-5 py-3.5">
								Winner Wallet
							</th>
							<th scope="col" className="px-5 py-3.5">
								Release TX
							</th>
							<th scope="col" className="px-5 py-3.5">
								Date
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-white/5">
						{releasedPrizes.map((payout) => {
							const txHash = payout.forwardTxHash || payout.releaseTxHash || "";
							const date = payout.paidOutAt || payout.releasedAt;

							return (
								<tr
									key={payout.id}
									className="transition-colors hover:bg-white/[0.02]"
								>
									<td className="px-5 py-4 font-medium text-white">
										<span className="inline-flex items-center gap-1.5">
											<CheckCircle2
												className="h-4 w-4 text-emerald-400"
												aria-hidden="true"
											/>
											#{payout.rank} Place
										</span>
									</td>
									<td className="px-5 py-4 font-mono font-medium text-emerald-400">
										{formatAmount(payout.amountUsdc)}
									</td>
									<td className="px-5 py-4 font-mono text-xs text-white/60">
										{payout.winnerAddress
											? truncateHash(payout.winnerAddress, 6, 6)
											: "Anonymous"}
									</td>
									<td className="px-5 py-4">
										{txHash ? (
											<TxHashLink hash={txHash} network={network} />
										) : (
											<span className="text-xs text-white/40">—</span>
										)}
									</td>
									<td className="px-5 py-4 text-xs text-white/50">
										{formatDate(date)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
