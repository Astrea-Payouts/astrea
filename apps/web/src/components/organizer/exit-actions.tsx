"use client";

import {
	AlertCircle,
	AlertTriangle,
	ArrowDownLeft,
	CheckCircle2,
	Clock,
	Loader2,
	ShieldAlert,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import {
	getEmergencyWithdrawDisplay,
	isPreLiveExitAllowed,
} from "@/lib/organizer/organizer-helpers";
import type {
	EmergencyWithdrawState,
	EventStatus,
	FundingDetails,
} from "@/lib/organizer/types";
import { cn } from "@/lib/utils";

export interface ExitActionsProps {
	eventStatus: EventStatus;
	funding: FundingDetails;
	emergencyWithdraw: EmergencyWithdrawState;
	onCancelEvent?: () => Promise<{ success: boolean; refundTxHash?: string }>;
	onRequestEmergencyWithdraw?: (
		reason: string,
	) => Promise<{ success: boolean }>;
	className?: string;
}

export function ExitActions({
	eventStatus,
	funding,
	emergencyWithdraw,
	onCancelEvent,
	onRequestEmergencyWithdraw,
	className,
}: ExitActionsProps) {
	const preLive = isPreLiveExitAllowed(eventStatus);
	const withdrawDisplay = getEmergencyWithdrawDisplay(
		emergencyWithdraw,
		eventStatus,
	);

	// Cancellation modal state
	const [cancelModalOpen, setCancelModalOpen] = useState(false);
	const [isCancelling, setIsCancelling] = useState(false);
	const [cancelSuccessTx, setCancelSuccessTx] = useState<string | null>(null);

	// Emergency withdraw modal state
	const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
	const [withdrawReason, setWithdrawReason] = useState("");
	const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
	const [withdrawFeedback, setWithdrawFeedback] = useState<string | null>(null);

	const [error, setError] = useState<string | null>(null);

	// If event is LIVE or terminal, pre-LIVE exit actions are not available
	if (!preLive) {
		return null;
	}

	const handleCancelSubmit = async () => {
		setIsCancelling(true);
		setError(null);
		try {
			if (onCancelEvent) {
				const res = await onCancelEvent();
				if (res.success) {
					setCancelSuccessTx(
						res.refundTxHash ||
							"9f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
					);
				}
			} else {
				// Simulating transaction settlement delay
				await new Promise((resolve) => setTimeout(resolve, 1500));
				setCancelSuccessTx(
					"9f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
				);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to cancel event escrow.",
			);
		} finally {
			setIsCancelling(false);
		}
	};

	const handleEmergencyWithdrawSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!withdrawReason.trim()) {
			setError("Please specify a justification for the emergency withdrawal.");
			return;
		}

		setIsSubmittingWithdraw(true);
		setError(null);
		try {
			if (onRequestEmergencyWithdraw) {
				await onRequestEmergencyWithdraw(withdrawReason);
			} else {
				await new Promise((resolve) => setTimeout(resolve, 1500));
			}
			setWithdrawFeedback(
				"Organizer signature recorded. Request is now pending resolver co-signature (ADR-006).",
			);
			setTimeout(() => {
				setWithdrawModalOpen(false);
				setWithdrawFeedback(null);
			}, 3000);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to submit emergency withdrawal request.",
			);
		} finally {
			setIsSubmittingWithdraw(false);
		}
	};

	return (
		<div
			className={cn(
				"rounded-2xl border border-red-500/20 bg-red-950/10 p-6 backdrop-blur md:p-8",
				className,
			)}
		>
			<div className="flex items-center gap-3">
				<div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
					<ShieldAlert className="size-5" />
				</div>
				<div>
					<h3 className="text-lg font-bold text-white">Pre-LIVE Exit Paths</h3>
					<p className="text-xs text-zinc-400">
						Available only before event publication. These exit paths
						automatically lock once the event transitions to LIVE.
					</p>
				</div>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
				{/* Exit Action 1: Cancel Event (Full Refund) */}
				<div className="rounded-xl border border-white/10 bg-black/40 p-5 flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between">
							<h4 className="font-semibold text-white">Cancel Event</h4>
							<span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
								1-Signature
							</span>
						</div>
						<p className="mt-2 text-xs text-zinc-400">
							Cancels the event escrow and issues a full refund of all deposited
							funds ({funding.currentBalance.toLocaleString()}{" "}
							{funding.currency}) back to the organizer wallet.
						</p>
					</div>

					<div className="mt-6">
						<button
							type="button"
							onClick={() => setCancelModalOpen(true)}
							className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
						>
							<XCircle className="size-4" />
							<span>Cancel & Request Full Refund</span>
						</button>
					</div>
				</div>

				{/* Exit Action 2: Emergency Withdraw (2-Signature ADR-006) */}
				<div className="rounded-xl border border-white/10 bg-black/40 p-5 flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between">
							<h4 className="font-semibold text-white">
								Emergency Withdraw Request
							</h4>
							<span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-400">
								2-Signatures (ADR-006)
							</span>
						</div>
						<p className="mt-2 text-xs text-zinc-400">
							Organizer signs their half of the emergency recovery transaction.
							Funds remain locked in escrow until the designated dispute
							resolver asynchronously co-signs.
						</p>
					</div>

					<div className="mt-6">
						{withdrawDisplay.isPendingResolver ? (
							<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
								<Clock className="size-4 mt-0.5 shrink-0 text-amber-400" />
								<div>
									<span className="font-semibold block">
										Pending Resolver Co-Signature
									</span>
									<span className="text-[11px] text-zinc-400 mt-0.5 block">
										Organizer half signed. Awaiting resolver verification before
										funds can be released.
									</span>
								</div>
							</div>
						) : withdrawDisplay.isCompleted ? (
							<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
								<CheckCircle2 className="size-4 text-emerald-400" />
								<span>Co-signed & Released</span>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setWithdrawModalOpen(true)}
								disabled={!withdrawDisplay.canRequest}
								className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
							>
								<ArrowDownLeft className="size-4" />
								<span>Initiate 2-Sig Emergency Withdraw</span>
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Modal Cancel Event */}
			{cancelModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
					<div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
						<div className="flex items-center gap-3 text-red-400">
							<AlertTriangle className="size-6" />
							<h3 className="text-lg font-bold text-white">
								Confirm Event Cancellation
							</h3>
						</div>

						{cancelSuccessTx ? (
							<div className="mt-4">
								<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
									<CheckCircle2 className="mx-auto size-8 text-emerald-400" />
									<h4 className="mt-2 font-bold text-white">
										Event Successfully Cancelled
									</h4>
									<p className="mt-1 text-xs text-zinc-400">
										All escrow funds have been refunded to your wallet.
									</p>
								</div>
								<div className="mt-4 flex justify-end">
									<button
										type="button"
										onClick={() => {
											setCancelModalOpen(false);
											setCancelSuccessTx(null);
										}}
										className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-colors"
									>
										Close
									</button>
								</div>
							</div>
						) : (
							<div className="mt-4">
								<p className="text-sm text-zinc-300">
									Are you sure you want to cancel this event? This will revoke
									all participant entries and trigger an immediate on-chain
									refund of{" "}
									<span className="font-bold text-white">
										{funding.currentBalance.toLocaleString()} {funding.currency}
									</span>{" "}
									to your organizer address.
								</p>

								{error && (
									<div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
										{error}
									</div>
								)}

								<div className="mt-6 flex items-center justify-end gap-3">
									<button
										type="button"
										disabled={isCancelling}
										onClick={() => setCancelModalOpen(false)}
										className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
									>
										Back
									</button>
									<button
										type="button"
										disabled={isCancelling}
										onClick={handleCancelSubmit}
										className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
									>
										{isCancelling && (
											<Loader2 className="size-3.5 animate-spin" />
										)}
										<span>
											{isCancelling
												? "Processing Refund..."
												: "Yes, Cancel Event"}
										</span>
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Modal Emergency Withdraw (ADR-006) */}
			{withdrawModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
					<div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
						<div className="flex items-center gap-3 text-amber-400">
							<AlertCircle className="size-6" />
							<h3 className="text-lg font-bold text-white">
								Request Emergency Withdrawal
							</h3>
						</div>

						<form onSubmit={handleEmergencyWithdrawSubmit} className="mt-4">
							<p className="text-xs text-zinc-300">
								Per ADR-006, emergency withdrawals require dual authorization:
							</p>
							<ol className="mt-2 list-decimal list-inside text-xs text-zinc-400 space-y-1">
								<li>You sign your organizer authorization now.</li>
								<li>The designated resolver co-signs asynchronously.</li>
							</ol>

							<div className="mt-4">
								<label
									htmlFor="emergency-withdraw-reason"
									className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1"
								>
									Reason / Justification
								</label>
								<textarea
									id="emergency-withdraw-reason"
									rows={3}
									value={withdrawReason}
									onChange={(e) => setWithdrawReason(e.target.value)}
									placeholder="e.g. Protocol migration or unforeseen venue cancellation"
									disabled={isSubmittingWithdraw}
									className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
								/>
							</div>

							{withdrawFeedback && (
								<div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
									{withdrawFeedback}
								</div>
							)}

							{error && (
								<div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
									{error}
								</div>
							)}

							<div className="mt-6 flex items-center justify-end gap-3">
								<button
									type="button"
									disabled={isSubmittingWithdraw}
									onClick={() => setWithdrawModalOpen(false)}
									className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isSubmittingWithdraw}
									className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
								>
									{isSubmittingWithdraw && (
										<Loader2 className="size-3.5 animate-spin" />
									)}
									<span>
										{isSubmittingWithdraw
											? "Signing..."
											: "Sign & Submit Request"}
									</span>
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
