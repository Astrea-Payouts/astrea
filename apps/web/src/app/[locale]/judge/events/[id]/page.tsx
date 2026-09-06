"use client";

import { ArrowLeft, DollarSign, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useState } from "react";
import { ApproveReleaseSigning } from "@/components/judge/approve-release-signing";
import { SubmissionReview } from "@/components/judge/submission-review";
import { WinnerAssignment } from "@/components/judge/winner-assignment";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";
import type { JudgePrize, JudgeSignerInfo } from "@/lib/judge/types";

interface PageProps {
	params: Promise<{
		locale: string;
		id: string;
	}>;
}

export default function JudgeEventPage({ params }: PageProps) {
	const resolvedParams = use(params);
	const { id: eventId } = resolvedParams;
	const t = useTranslations("JudgePage");

	// Mock judge panel state per ADR-003
	const [signerInfo] = useState<JudgeSignerInfo>({
		address: "GDMULTISIGJUDGE777777777777777777777777777777777777777777",
		isMultisig: true,
		totalSigners: 3,
		requiredSignatures: 2,
		collectedSignatures: 1,
	});

	// Mock prizes and submissions for this event
	const [prizes, setPrizes] = useState<JudgePrize[]>([
		{
			id: "prize-1",
			title: "1st Place Grand Prize",
			amount: 10000,
			currency: "USDC",
			status: "WINNER_ASSIGNED",
			assignedWinnerWallet:
				"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			winnerTrustlineVerified: true,
			submissions: [
				{
					id: "sub-1",
					participantWallet:
						"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
					projectTitle: "Soroban Trustless AMM & Liquidity Vault",
					url: "https://github.com/astrea-payouts/astrea",
					submittedAt: "2026-09-05T10:00:00Z",
					score: 96,
					notes: "Production ready smart contracts with 100% test coverage.",
				},
				{
					id: "sub-2",
					participantWallet:
						"GCD6W67MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5GBBD47IF",
					projectTitle: "Cross-Chain Stellar Bridge Protocol",
					url: "https://stellar.org",
					submittedAt: "2026-09-05T14:30:00Z",
					score: 88,
					notes: "Decentralized relay mechanism.",
				},
			],
		},
		{
			id: "prize-2",
			title: "2nd Place Runner Up",
			amount: 3500,
			currency: "USDC",
			status: "PENDING_REVIEW",
			submissions: [
				{
					id: "sub-3",
					participantWallet:
						"GCD6W67MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5GBBD47IF",
					projectTitle: "Cross-Chain Stellar Bridge Protocol",
					url: "https://stellar.org",
					submittedAt: "2026-09-05T14:30:00Z",
					score: 88,
				},
			],
		},
	]);

	const [activePrizeId, setActivePrizeId] = useState<string>("prize-1");
	const currentPrize = prizes.find((p) => p.id === activePrizeId) || prizes[0];

	// Handle selection of winner from review table
	const handleSelectWinner = (prizeId: string, winnerWallet: string) => {
		setPrizes((prev) =>
			prev.map((p) => {
				if (p.id === prizeId) {
					return {
						...p,
						status: "WINNER_ASSIGNED",
						assignedWinnerWallet: winnerWallet,
						winnerTrustlineVerified: true,
					};
				}
				return p;
			}),
		);
	};

	// Handle winner assignment confirmation
	const handleAssignWinnerConfirmed = (
		prizeId: string,
		winnerWallet: string,
	) => {
		setPrizes((prev) =>
			prev.map((p) => {
				if (p.id === prizeId) {
					return {
						...p,
						status: "WINNER_ASSIGNED",
						assignedWinnerWallet: winnerWallet,
						winnerTrustlineVerified: true,
					};
				}
				return p;
			}),
		);
	};

	// Handle on-chain approve confirmation
	const handleApproveConfirmed = (prizeId: string, txHash: string) => {
		setPrizes((prev) =>
			prev.map((p) => {
				if (p.id === prizeId) {
					return {
						...p,
						status: "APPROVED",
						approveTxHash: txHash,
					};
				}
				return p;
			}),
		);
	};

	// Handle on-chain release confirmation
	const handleReleaseConfirmed = (prizeId: string, txHash: string) => {
		setPrizes((prev) =>
			prev.map((p) => {
				if (p.id === prizeId) {
					return {
						...p,
						status: "RELEASED",
						releaseTxHash: txHash,
					};
				}
				return p;
			}),
		);
	};

	return (
		<main className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-12">
			<div className="mx-auto max-w-6xl space-y-8">
				{/* Top navigation */}
				<div className="flex items-center justify-between gap-4">
					<Link
						href={`/events/${eventId}`}
						className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
					>
						<ArrowLeft className="size-4" />
						{t("backToEvent")}
					</Link>
					<div className="flex items-center gap-3">
						<WalletConnectButton />
					</div>
				</div>

				{/* Header Banner */}
				<div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950/30 via-zinc-900/40 to-black p-6 sm:p-8 backdrop-blur">
					<div className="flex flex-wrap items-center gap-3 mb-3">
						<span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
							<Scale className="size-3.5" />
							{t("badge")}
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-mono text-zinc-300">
							<DollarSign className="size-3.5 text-emerald-400" />
							13,500 USDC Prize Pool
						</span>
					</div>

					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
						{t("pageTitle")}
					</h1>
					<p className="mt-2 text-sm text-zinc-400 max-w-3xl leading-relaxed">
						{t("pageDescription")}
					</p>
				</div>

				{/* Submissions Evaluation Panel */}
				<div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur">
					<SubmissionReview
						prizes={prizes}
						activePrizeId={activePrizeId}
						onSelectPrize={(id) => setActivePrizeId(id)}
						onSelectWinner={handleSelectWinner}
					/>
				</div>

				{/* Winner Assignment & Trustline Verification (ADR-004) */}
				{currentPrize && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
						<WinnerAssignment
							prize={currentPrize}
							onAssignWinnerConfirmed={handleAssignWinnerConfirmed}
						/>

						<ApproveReleaseSigning
							prize={currentPrize}
							signerInfo={signerInfo}
							onApproveConfirmed={handleApproveConfirmed}
							onReleaseConfirmed={handleReleaseConfirmed}
						/>
					</div>
				)}
			</div>
		</main>
	);
}
