"use client";

import {
	AlertCircle,
	AlertTriangle,
	Calendar,
	CheckCircle2,
	ExternalLink,
	Loader2,
	Radio,
	Rocket,
	ShieldCheck,
	User,
} from "lucide-react";
import { useState } from "react";
import {
	canPublishEvent,
	getEventStatusBadge,
} from "@/lib/organizer/organizer-helpers";
import type {
	CancelEventResult,
	EmergencyWithdrawRequestResult,
	OrganizerEvent,
	PublishEventResult,
} from "@/lib/organizer/types";
import { cn } from "@/lib/utils";
import { ExitActions } from "./exit-actions";
import { FundingStatus } from "./funding-status";
import { ParticipantList } from "./participant-list";

export interface EventDashboardProps {
	initialEvent: OrganizerEvent;
	onPublishEvent?: (eventId: string) => Promise<PublishEventResult>;
	onCancelEvent?: (eventId: string) => Promise<CancelEventResult>;
	onRequestEmergencyWithdraw?: (
		eventId: string,
		reason: string,
	) => Promise<EmergencyWithdrawRequestResult>;
	onTopUp?: (eventId: string, amount: number) => Promise<void>;
	className?: string;
}

export function EventDashboard({
	initialEvent,
	onPublishEvent,
	onCancelEvent,
	onRequestEmergencyWithdraw,
	onTopUp,
	className,
}: EventDashboardProps) {
	const [event, setEvent] = useState<OrganizerEvent>(initialEvent);
	const [isPublishing, setIsPublishing] = useState(false);
	const [publishSuccess, setPublishSuccess] = useState(false);
	const [publishError, setPublishError] = useState<string | null>(null);

	const statusBadge = getEventStatusBadge(event.status);
	const readyToPublish = canPublishEvent(event);

	const handlePublish = async () => {
		if (!readyToPublish || isPublishing) return;

		setIsPublishing(true);
		setPublishError(null);
		try {
			if (onPublishEvent) {
				const result = await onPublishEvent(event.id);
				if (result.success && result.event) {
					setEvent(result.event);
					setPublishSuccess(true);
				} else if (result.error) {
					throw new Error(result.error);
				}
			} else {
				// Simulating API call to Go service POST /events/:id/start
				await new Promise((resolve) => setTimeout(resolve, 1500));
				setEvent((prev) => ({
					...prev,
					status: "LIVE",
					publishedAt: new Date().toISOString(),
				}));
				setPublishSuccess(true);
			}
		} catch (err) {
			setPublishError(
				err instanceof Error
					? err.message
					: "Failed to publish event. Please verify contract conditions.",
			);
		} finally {
			setIsPublishing(false);
		}
	};

	const handleCancel = async () => {
		if (onCancelEvent) {
			const res = await onCancelEvent(event.id);
			if (res.success) {
				setEvent((prev) => ({ ...prev, status: "CANCELLED" }));
			}
			return res;
		}
		// Local mock fallback
		await new Promise((resolve) => setTimeout(resolve, 1500));
		setEvent((prev) => ({ ...prev, status: "CANCELLED" }));
		return {
			success: true,
			refundTxHash:
				"9f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
		};
	};

	const handleEmergencyWithdraw = async (reason: string) => {
		if (onRequestEmergencyWithdraw) {
			const res = await onRequestEmergencyWithdraw(event.id, reason);
			if (res.success) {
				setEvent((prev) => ({
					...prev,
					emergencyWithdraw: {
						...prev.emergencyWithdraw,
						status: "PENDING_RESOLVER_SIGNATURE",
						organizerSigned: true,
						resolverCoSigned: false,
						reason,
						requestedAt: new Date().toISOString(),
					},
				}));
			}
			return res;
		}
		// Local mock fallback
		await new Promise((resolve) => setTimeout(resolve, 1500));
		setEvent((prev) => ({
			...prev,
			emergencyWithdraw: {
				...prev.emergencyWithdraw,
				status: "PENDING_RESOLVER_SIGNATURE",
				organizerSigned: true,
				resolverCoSigned: false,
				reason,
				requestedAt: new Date().toISOString(),
			},
		}));
		return { success: true };
	};

	const handleTopUp = async (amount: number) => {
		if (onTopUp) {
			await onTopUp(event.id, amount);
		} else {
			await new Promise((resolve) => setTimeout(resolve, 1500));
		}
		setEvent((prev) => {
			const newBalance = prev.funding.currentBalance + amount;
			const isFunded = newBalance >= prev.funding.targetAmount;
			const meetsReqs =
				isFunded &&
				prev.funding.registeredParticipantsCount >=
					prev.funding.requiredMinParticipants;
			return {
				...prev,
				conditionsMetAt: meetsReqs
					? prev.conditionsMetAt || new Date().toISOString()
					: prev.conditionsMetAt,
				funding: {
					...prev.funding,
					currentBalance: newBalance,
					isFunded,
				},
			};
		});
	};

	const truncatedContract = `${event.funding.contractId.slice(0, 8)}...${event.funding.contractId.slice(-8)}`;
	const explorerContractUrl = `https://stellar.expert/explorer/testnet/contract/${event.funding.contractId}`;

	return (
		<div className={cn("space-y-8", className)}>
			{/* Header Section */}
			<div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur md:p-10">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-3">
							<span
								className={cn(
									"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider",
									statusBadge.colorClass,
								)}
							>
								{statusBadge.isLive && (
									<span className="relative flex size-2">
										<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
										<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
									</span>
								)}
								<span>{event.status.replace("_", " ")}</span>
							</span>

							<div className="inline-flex items-center gap-1 font-mono text-xs text-zinc-400">
								<span>Contract:</span>
								<a
									href={explorerContractUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-zinc-300 hover:text-white transition-colors"
								>
									<span>{truncatedContract}</span>
									<ExternalLink className="size-3 text-zinc-500" />
								</a>
							</div>
						</div>

						<h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-white md:text-4xl">
							{event.title}
						</h1>
						<p className="mt-2 max-w-3xl text-sm text-zinc-400">
							{event.description}
						</p>

						<div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-zinc-400 font-medium">
							<div className="inline-flex items-center gap-2">
								<Calendar className="size-4 text-zinc-500" />
								<span>
									Created:{" "}
									{new Date(event.createdAt).toLocaleDateString(undefined, {
										month: "short",
										day: "numeric",
										year: "numeric",
									})}
								</span>
							</div>

							<div className="inline-flex items-center gap-2 font-mono">
								<User className="size-4 text-zinc-500" />
								<span>
									Organizer: {event.organizerAddress.slice(0, 6)}...
									{event.organizerAddress.slice(-6)}
								</span>
							</div>

							{event.publishedAt && (
								<div className="inline-flex items-center gap-2 text-emerald-400">
									<Radio className="size-4" />
									<span>
										Published:{" "}
										{new Date(event.publishedAt).toLocaleDateString(undefined, {
											month: "short",
											day: "numeric",
											year: "numeric",
										})}
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Side-State Alert: DISPUTED */}
			{event.status === "DISPUTED" && (
				<div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
					<div className="flex items-start gap-4">
						<AlertCircle className="size-6 text-red-400 shrink-0 mt-0.5" />
						<div>
							<h3 className="font-bold text-red-300 text-lg">
								Event In Dispute
							</h3>
							<p className="mt-1 text-sm text-zinc-300">
								An active dispute has been filed on this event's escrow. Payout
								distribution and release actions are temporarily halted pending
								review by the designated dispute resolver.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Side-State Alert: CANCELLED */}
			{event.status === "CANCELLED" && (
				<div className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-6">
					<div className="flex items-start gap-4">
						<AlertTriangle className="size-6 text-zinc-400 shrink-0 mt-0.5" />
						<div>
							<h3 className="font-bold text-zinc-200 text-lg">
								Event Cancelled
							</h3>
							<p className="mt-1 text-sm text-zinc-400">
								This event was cancelled prior to going live. All escrow funds
								have been refunded to the organizer wallet.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* "Ready to start" Banner (Explicit Publish Gate) */}
			{readyToPublish && (
				<div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-black p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg shadow-emerald-950/20">
					<div className="max-w-2xl">
						<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400">
							<ShieldCheck className="size-3.5" />
							<span>Conditions Met</span>
						</div>
						<h3 className="mt-3 text-xl font-bold text-white">
							Event is Ready to Start
						</h3>
						<p className="mt-1 text-sm text-zinc-400">
							Escrow balance verified and participant criteria fulfilled. Per
							platform policy, events do not launch automatically. Click below
							to explicitly publish this event and open live submissions.
						</p>
					</div>

					<div className="flex flex-col items-start md:items-end gap-2 shrink-0">
						<button
							type="button"
							onClick={handlePublish}
							disabled={isPublishing}
							className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-md"
						>
							{isPublishing ? (
								<Loader2 className="size-4 animate-spin text-black" />
							) : (
								<Rocket className="size-4" />
							)}
							<span>
								{isPublishing ? "Publishing Event..." : "Publish Event"}
							</span>
						</button>
						<span className="text-[11px] text-zinc-500">
							Requires organizer confirmation
						</span>
					</div>
				</div>
			)}

			{publishSuccess && (
				<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300 flex items-center gap-3">
					<CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
					<p className="text-sm">
						Event is now <strong className="text-white font-bold">LIVE</strong>.
						Public registration and submissions are actively accepting entries.
					</p>
				</div>
			)}

			{publishError && (
				<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 flex items-center gap-3">
					<AlertCircle className="size-5 text-red-400 shrink-0" />
					<p className="text-sm">{publishError}</p>
				</div>
			)}

			{/* Section: Funding Status */}
			<FundingStatus
				funding={event.funding}
				eventStatus={event.status}
				onTopUp={handleTopUp}
			/>

			{/* Section: Participant Management (Read-Only) */}
			<ParticipantList
				participants={event.participants}
				minRequired={event.funding.requiredMinParticipants}
			/>

			{/* Section: Pre-LIVE Exit Actions */}
			<ExitActions
				eventStatus={event.status}
				funding={event.funding}
				emergencyWithdraw={event.emergencyWithdraw}
				onCancelEvent={handleCancel}
				onRequestEmergencyWithdraw={handleEmergencyWithdraw}
			/>
		</div>
	);
}
