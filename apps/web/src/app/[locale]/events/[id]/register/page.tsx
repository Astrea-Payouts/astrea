"use client";

import { ArrowLeft, DollarSign, Shield, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useState } from "react";
import { ParticipantProgressView } from "@/components/participant/progress-view";
import { RegistrationForm } from "@/components/participant/registration-form";
import { TrustlineCheck } from "@/components/participant/trustline-check";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";
import type {
	ParticipantRegistration,
	ParticipantSubmission,
	UsdcTrustlineState,
} from "@/lib/participant/types";

interface PageProps {
	params: Promise<{
		locale: string;
		id: string;
	}>;
}

export default function EventRegisterPage({ params }: PageProps) {
	const resolvedParams = use(params);
	const { id: eventId } = resolvedParams;
	const t = useTranslations("EventRegisterPage");

	// State for demonstration and participant flow lifecycle
	const [walletAddress, setWalletAddress] = useState<string | null>(null);
	const [trustlineStatus, setTrustlineStatus] =
		useState<UsdcTrustlineState>("IDLE");
	const [registration, setRegistration] =
		useState<ParticipantRegistration | null>(null);
	const [submission, setSubmission] = useState<ParticipantSubmission | null>(
		null,
	);

	// Event details (in production fetched via Go service / DB)
	const eventInfo = {
		id: eventId,
		title: "Stellar Global Hackathon 2026",
		description:
			"Build verifiable decentralized applications, DeFi primitives, or developer tooling on Soroban.",
		prizeTotal: 15000,
		currency: "USDC",
		status: "LIVE" as const,
		isRegistrationOpen: true,
	};

	return (
		<main className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-12">
			<div className="mx-auto max-w-5xl space-y-8">
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

				{/* Event Header Banner */}
				<div className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-950/30 via-zinc-900/40 to-black p-6 sm:p-8 backdrop-blur">
					<div className="flex flex-wrap items-center gap-3 mb-3">
						<span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
							<Trophy className="size-3.5" />
							{t("badge")}
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-mono text-zinc-300">
							<DollarSign className="size-3.5 text-emerald-400" />
							{eventInfo.prizeTotal.toLocaleString()} {eventInfo.currency} Prize
							Pool
						</span>
					</div>

					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
						{eventInfo.title}
					</h1>
					<p className="mt-2 text-sm text-zinc-400 max-w-3xl leading-relaxed">
						{eventInfo.description}
					</p>
				</div>

				{/* Participant Progress Tracker */}
				<ParticipantProgressView
					walletAddress={walletAddress}
					isRegistered={Boolean(registration)}
					trustlineStatus={trustlineStatus}
					submission={submission}
					eventStatus={eventInfo.status}
				/>

				{/* Trustline Verification Section */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="text-base font-semibold text-white flex items-center gap-2">
							<Shield className="size-4 text-blue-400" />
							{t("trustlineSectionTitle")}
						</h2>
						{/* Demo quick-connect toggle to test with a simulated funded Stellar address */}
						{!walletAddress ? (
							<button
								type="button"
								onClick={() =>
									setWalletAddress(
										"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
									)
								}
								className="text-xs text-blue-400 hover:text-blue-300 underline"
								data-testid="simulate-wallet-connect"
							>
								{t("simulateWallet")}
							</button>
						) : (
							<button
								type="button"
								onClick={() => {
									setWalletAddress(null);
									setRegistration(null);
									setSubmission(null);
									setTrustlineStatus("IDLE");
								}}
								className="text-xs text-zinc-400 hover:text-zinc-200 underline"
								data-testid="disconnect-wallet"
							>
								{t("disconnect")}
							</button>
						)}
					</div>
					<TrustlineCheck
						publicKey={walletAddress}
						onStatusChange={(st) => setTrustlineStatus(st)}
					/>
				</div>

				{/* Registration & Project Submission Form */}
				<div className="space-y-3">
					<RegistrationForm
						eventId={eventId}
						walletAddress={walletAddress}
						isRegistrationOpen={eventInfo.isRegistrationOpen}
						trustlineStatus={trustlineStatus}
						initialRegistration={registration}
						initialSubmission={submission}
						onRegister={(reg) => setRegistration(reg)}
						onSubmitProject={(sub) => setSubmission(sub)}
					/>
				</div>
			</div>
		</main>
	);
}
