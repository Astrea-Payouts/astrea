"use client";

import {
	AlertCircle,
	CheckCircle2,
	KeyRound,
	Loader2,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { TxHashLink } from "@/components/tx-hash-link";
import type { StellarNetwork } from "@/lib/explorer";
import type { TransactionPhase } from "@/lib/hooks/use-transaction-status";
import { cn } from "@/lib/utils";

export interface TransactionProgressProps {
	phase: TransactionPhase;
	progress: number;
	txHash?: string;
	network?: StellarNetwork;
	error?: string;
	onRetry?: () => void;
	className?: string;
	compact?: boolean;
	title?: string;
	description?: string;
	footerAction?: ReactNode;
}

interface StepConfig {
	id: string;
	label: string;
	activePhases: TransactionPhase[];
	completedPhases: TransactionPhase[];
}

const STEPS: StepConfig[] = [
	{
		id: "building",
		label: "1. Building",
		activePhases: ["building"],
		completedPhases: ["awaiting_signature", "pending", "confirmed"],
	},
	{
		id: "signing",
		label: "2. Signature",
		activePhases: ["awaiting_signature"],
		completedPhases: ["pending", "confirmed"],
	},
	{
		id: "consensus",
		label: "3. Consensus",
		activePhases: ["pending"],
		completedPhases: ["confirmed"],
	},
	{
		id: "confirmed",
		label: "4. Confirmed",
		activePhases: ["confirmed"],
		completedPhases: ["confirmed"],
	},
];

export function TransactionProgress({
	phase,
	progress,
	txHash,
	network = "testnet",
	error,
	onRetry,
	className,
	compact = false,
	title,
	description,
	footerAction,
}: TransactionProgressProps) {
	const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

	const getStatusConfig = () => {
		switch (phase) {
			case "building":
				return {
					badge: "Preparing",
					badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
					defaultTitle: "Preparing Transaction",
					defaultDesc:
						"Constructing Soroban smart contract call and validating parameters...",
					icon: <Loader2 className="size-5 animate-spin text-blue-400" />,
				};
			case "awaiting_signature":
				return {
					badge: "Awaiting Signature",
					badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
					defaultTitle: "Signature Requested",
					defaultDesc:
						"Please approve and sign the transaction prompt in your connected Stellar wallet.",
					icon: <KeyRound className="size-5 animate-pulse text-amber-400" />,
				};
			case "pending":
				return {
					badge: "Awaiting Ledger Consensus",
					badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
					defaultTitle: "Waiting for Ledger Consensus",
					defaultDesc:
						"Transaction broadcasted to Stellar network. Verifying final on-chain ledger state...",
					icon: <Loader2 className="size-5 animate-spin text-cyan-400" />,
				};
			case "confirmed":
				return {
					badge: "Confirmed On-Chain",
					badgeClass:
						"bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
					defaultTitle: "Transaction Confirmed",
					defaultDesc:
						"The transaction has been successfully confirmed and reconciled on Stellar.",
					icon: <CheckCircle2 className="size-5 text-emerald-400" />,
				};
			case "failed":
				return {
					badge: "Failed",
					badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
					defaultTitle: "Transaction Failed",
					defaultDesc:
						error ||
						"The on-chain transaction encountered an error or was rejected by the network.",
					icon: <AlertCircle className="size-5 text-red-400" />,
				};
			default:
				return {
					badge: "Ready",
					badgeClass: "bg-muted/40 text-muted-foreground border-border/40",
					defaultTitle: "Ready to Submit",
					defaultDesc:
						"Initiate transaction to start the escrow release or payout.",
					icon: <ShieldCheck className="size-5 text-muted-foreground" />,
				};
		}
	};

	const config = getStatusConfig();
	const displayTitle = title || config.defaultTitle;
	const displayDesc = description || config.defaultDesc;

	return (
		<section
			className={cn(
				"w-full rounded-xl border border-border/60 bg-card/70 p-4 text-card-foreground shadow-sm backdrop-blur-md transition-all md:p-6",
				phase === "pending" && "border-cyan-500/30 bg-cyan-950/10",
				phase === "confirmed" && "border-emerald-500/30 bg-emerald-950/10",
				phase === "failed" && "border-red-500/30 bg-red-950/10",
				className,
			)}
			aria-label="Transaction progress and confirmation state"
		>
			{/* Header with status badge and icon */}
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background/50">
						{config.icon}
					</div>
					<div>
						<h3 className="font-semibold text-base leading-tight md:text-lg">
							{displayTitle}
						</h3>
						<p className="mt-1 text-muted-foreground text-xs leading-relaxed md:text-sm">
							{displayDesc}
						</p>
					</div>
				</div>

				<span
					className={cn(
						"inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-medium text-xs tracking-wide uppercase",
						config.badgeClass,
					)}
				>
					{config.badge}
				</span>
			</div>

			{/* Step indicator (hidden in compact mode or on small mobile screens if space is tight) */}
			{!compact && (
				<div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/40 pt-4 sm:grid-cols-4">
					{STEPS.map((step) => {
						const isCompleted = step.completedPhases.includes(phase);
						const isActive = step.activePhases.includes(phase);

						return (
							<div
								key={step.id}
								className={cn(
									"flex flex-col gap-1 rounded-md border p-2 transition-colors text-xs",
									isActive &&
										"border-primary/50 bg-primary/5 font-semibold text-foreground",
									isCompleted &&
										!isActive &&
										"border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
									!isActive &&
										!isCompleted &&
										"border-transparent text-muted-foreground/60",
								)}
							>
								<div className="flex items-center gap-1.5">
									{isCompleted && !isActive ? (
										<CheckCircle2 className="size-3.5 text-emerald-400" />
									) : (
										<span
											className={cn(
												"size-2 rounded-full",
												isActive
													? "animate-ping bg-primary"
													: "bg-muted-foreground/40",
											)}
										/>
									)}
									<span className="truncate">{step.label}</span>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Progress bar */}
			<div className="mt-4">
				<div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
					<span>
						{phase === "pending"
							? "Reconciling on-chain state..."
							: phase === "confirmed"
								? "100% Reconciled"
								: `${clampedProgress}%`}
					</span>
					<span>{clampedProgress}%</span>
				</div>

				<div
					className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted/60"
					role="progressbar"
					aria-valuenow={clampedProgress}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label="On-chain confirmation progress"
				>
					<div
						className={cn(
							"h-full rounded-full transition-all duration-300 ease-out",
							phase === "confirmed" && "bg-emerald-500",
							phase === "failed" && "bg-red-500",
							phase === "pending" &&
								"bg-gradient-to-r from-cyan-500 to-blue-500 shadow-sm",
							phase === "building" && "bg-blue-500",
							phase === "awaiting_signature" && "bg-amber-500",
							phase === "idle" && "bg-muted-foreground/30",
						)}
						style={{ width: `${clampedProgress}%` }}
					/>
				</div>
			</div>

			{/* Terminal details: Explorer link on confirmed, Retry on failed */}
			{(txHash || phase === "failed" || footerAction) && (
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs md:text-sm">
					{txHash && (
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground">Tx Receipt:</span>
							<TxHashLink
								hash={txHash}
								network={network}
								showCopy={true}
								showExplorerIcon={true}
							/>
						</div>
					)}

					{phase === "failed" && onRetry && (
						<button
							type="button"
							onClick={onRetry}
							className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-medium text-red-300 transition-colors hover:bg-red-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
						>
							<RefreshCw className="size-3.5" />
							<span>Retry Transaction</span>
						</button>
					)}

					{footerAction && <div>{footerAction}</div>}
				</div>
			)}
		</section>
	);
}
