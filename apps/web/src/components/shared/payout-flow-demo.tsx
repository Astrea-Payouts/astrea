"use client";

import { Play, RotateCcw, XCircle } from "lucide-react";
import { useTransactionStatus } from "@/lib/hooks/use-transaction-status";
import { TransactionProgress } from "./transaction-progress";

export function PayoutFlowDemo() {
	const tx = useTransactionStatus({
		raceDurationMs: 2200,
	});

	const handleSimulateSuccess = () => {
		tx.startBuilding();
		setTimeout(() => {
			tx.startSigning();
			setTimeout(() => {
				tx.submit(
					"6b041eb9bb62939316d9a04ad53cf5db3ce2bb9cf7bcfe21609101ad4043b27b",
				);
				setTimeout(() => {
					tx.confirm(
						"6b041eb9bb62939316d9a04ad53cf5db3ce2bb9cf7bcfe21609101ad4043b27b",
					);
				}, 3200);
			}, 1400);
		}, 900);
	};

	const handleSimulateFailure = () => {
		tx.startBuilding();
		setTimeout(() => {
			tx.startSigning();
			setTimeout(() => {
				tx.fail("User rejected transaction in wallet (Freighter code: -4).");
			}, 1200);
		}, 800);
	};

	return (
		<div className="flex flex-col gap-4">
			<TransactionProgress
				phase={tx.phase}
				progress={tx.progress}
				txHash={tx.txHash}
				error={tx.error}
				onRetry={() => {
					tx.retry();
					handleSimulateSuccess();
				}}
			/>

			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={handleSimulateSuccess}
					disabled={tx.isPending}
					className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
				>
					<Play className="size-3.5" />
					<span>Simulate Payout Success</span>
				</button>
				<button
					type="button"
					onClick={handleSimulateFailure}
					disabled={tx.isPending}
					className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
				>
					<XCircle className="size-3.5" />
					<span>Simulate Rejection</span>
				</button>
				<button
					type="button"
					onClick={tx.reset}
					className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					<RotateCcw className="size-3.5" />
					<span>Reset</span>
				</button>
			</div>
		</div>
	);
}
