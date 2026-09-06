import { Trophy } from "lucide-react";
import { BorderGlowInView } from "@/components/marketing/border-glow-in-view";
import { cn } from "@/lib/utils";

export interface PublicPrizeItem {
	id: string;
	rank: number;
	amountUsdc: number | string;
	status: string;
	milestoneIndex?: number;
}

export interface PrizeListProps {
	prizes: PublicPrizeItem[];
	className?: string;
}

function formatRank(rank: number): string {
	if (rank === 1) return "1st Place";
	if (rank === 2) return "2nd Place";
	if (rank === 3) return "3rd Place";
	return `${rank}th Place`;
}

function formatAmount(amount: number | string): string {
	const numeric = typeof amount === "number" ? amount : parseFloat(amount);
	if (Number.isNaN(numeric)) return String(amount);
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 2,
	})
		.format(numeric)
		.replace("USD", "USDC");
}

function getStatusBadgeClass(status: string): string {
	switch (status.toUpperCase()) {
		case "PAID_OUT":
		case "RELEASED":
			return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
		case "APPROVED":
			return "bg-blue-500/10 text-blue-400 border-blue-500/20";
		case "ASSIGNED":
			return "bg-amber-500/10 text-amber-400 border-amber-500/20";
		case "DISPUTED":
			return "bg-rose-500/10 text-rose-400 border-rose-500/20";
		default:
			return "bg-white/5 text-white/60 border-white/10";
	}
}

export function PrizeList({ prizes, className }: PrizeListProps) {
	if (!prizes || prizes.length === 0) {
		return (
			<div className="rounded-xl border border-white/10 bg-zinc-950/60 p-6 text-center text-sm text-white/50">
				No prizes configured for this event.
			</div>
		);
	}

	const sortedPrizes = [...prizes].sort((a, b) => a.rank - b.rank);

	return (
		<div
			className={cn(
				"grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
				className,
			)}
		>
			{sortedPrizes.map((prize) => {
				const isTopRank = prize.rank === 1;
				const isReleased =
					prize.status === "RELEASED" || prize.status === "PAID_OUT";

				return (
					<BorderGlowInView
						key={prize.id}
						glowColor={isTopRank ? "45 100% 70%" : "215 100% 70%"}
						glowIntensity={isTopRank ? 1.2 : 0.8}
						className="relative flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-950/80 p-5 backdrop-blur-sm transition-all"
					>
						<div>
							<div className="flex items-center justify-between gap-2">
								<span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-white/60 uppercase">
									<Trophy
										className={cn(
											"h-3.5 w-3.5",
											isTopRank ? "text-amber-400" : "text-white/40",
										)}
										aria-hidden="true"
									/>
									{formatRank(prize.rank)}
								</span>
								<span
									className={cn(
										"inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
										getStatusBadgeClass(prize.status),
									)}
								>
									{prize.status}
								</span>
							</div>

							<div className="mt-4">
								<p className="font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">
									{formatAmount(prize.amountUsdc)}
								</p>
								<p className="mt-1 text-xs text-white/50">
									Milestone #{prize.milestoneIndex ?? prize.rank - 1}
								</p>
							</div>
						</div>

						{isReleased && (
							<div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-emerald-400 font-medium">
								✓ Released on-chain
							</div>
						)}
					</BorderGlowInView>
				);
			})}
		</div>
	);
}
