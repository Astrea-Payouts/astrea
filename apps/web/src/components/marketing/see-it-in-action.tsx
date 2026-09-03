"use client";

import {
	CheckCircle2,
	Coins,
	ExternalLink,
	ShieldCheck,
	Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardSwap } from "@/components/marketing/card-swap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SampleEvent {
	id: string;
	title: string;
	category: string;
	prizePool: string;
	escrowStatus: string;
	participants: number;
	milestones: string[];
	txHash: string;
}

export function SeeItInAction() {
	const t = useTranslations("SeeItInAction");
	const reduced = useReducedMotion();

	const events: SampleEvent[] = [
		{
			id: "stellar-defi-2026",
			title: "Stellar Global DeFi & Payments Hackathon",
			category: "Smart Escrows",
			prizePool: "$25,000 USDC",
			escrowStatus: "Verified On-Chain (Soroban)",
			participants: 142,
			milestones: [
				"M1: Architecture & Smart Contract (30%) — Released",
				"M2: Frontend & Wallet Integration (40%) — In Review",
				"M3: Mainnet Demo & Final Pitch (30%) — Locked",
			],
			txHash: "9a2f7c...41e8",
		},
		{
			id: "rust-zk-bounties",
			title: "Rust & Zero-Knowledge Verification Sprint",
			category: "Micro-Bounties",
			prizePool: "$8,500 USDC",
			escrowStatus: "Funded & Multi-Sig Guarded",
			participants: 68,
			milestones: [
				"Bounty #1: Optimizing Ed25519 Verify — $2,500 Released",
				"Bounty #2: Soroban WASM Memory Profiler — $3,000 In Progress",
				"Bounty #3: Verifiable Log Relayer — $3,000 Open",
			],
			txHash: "4c1e82...99d1",
		},
		{
			id: "community-tooling",
			title: "Decentralized Payouts & Builder Grants",
			category: "Community Challenge",
			prizePool: "$15,000 USDC",
			escrowStatus: "100% Locked in Escrow",
			participants: 94,
			milestones: [
				"Stage 1: PWA Mobile Native Wallet Client — Released",
				"Stage 2: Dynamic Social Preview & Metadata Relayer — In Progress",
				"Stage 3: Automated On-Chain Dispute Mediation — Locked",
			],
			txHash: "7b0d11...32af",
		},
	];

	return (
		<section className="relative overflow-hidden bg-zinc-950 py-12 text-white md:py-16">
			<div className="mx-auto max-w-6xl px-6 md:px-12">
				<div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
					<div className="lg:col-span-5">
						<div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
							<ShieldCheck className="size-3.5" />
							<span>{t("badge")}</span>
						</div>
						<h2 className="mt-4 font-serif text-3xl font-bold tracking-tight md:text-4xl">
							{t("title")}
						</h2>
						<p className="mt-4 text-base leading-relaxed text-zinc-400">
							{t("description")}
						</p>

						<div className="mt-8 space-y-4">
							<div className="flex items-start gap-3">
								<div className="rounded-lg border border-white/10 bg-white/5 p-2">
									<Coins className="size-5 text-blue-400" />
								</div>
								<div>
									<h4 className="font-semibold text-white">
										{t("feature1Title")}
									</h4>
									<p className="text-sm text-zinc-400">{t("feature1Desc")}</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<div className="rounded-lg border border-white/10 bg-white/5 p-2">
									<Trophy className="size-5 text-indigo-400" />
								</div>
								<div>
									<h4 className="font-semibold text-white">
										{t("feature2Title")}
									</h4>
									<p className="text-sm text-zinc-400">{t("feature2Desc")}</p>
								</div>
							</div>
						</div>
					</div>

					{reduced ? (
						/* Reduced motion: the same three events, listed. CardSwap is
						Tier 1 twice over under docs/ui-motion.md's policy — it moves
						cards across the viewport with rotation and skew, and it does so
						on a 4.5s setInterval the visitor never asked for, which is the
						auto-updating-content case WCAG 2.2.2 covers at AA.

						It is a static list rather than a frozen stack because the stack
						only shows one card's content; the other two are decorative
						edges behind it. Freezing it would leave two thirds of the
						section permanently unreadable. */
						<ul className="space-y-4 lg:col-span-7">
							{events.map((evt) => (
								<li
									key={evt.id}
									className="rounded-xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl"
								>
									<EventCardBody evt={evt} />
								</li>
							))}
						</ul>
					) : (
						<>
							{/* CardSwap needs a positioned parent; the height reserves
							layout space. Upstream anchors its own container bottom-right
							and pushes it further out (translate-x-[25%] under 768px) for a
							deliberate off-canvas bleed — that only works beside the text
							column on desktop. Below lg it puts the stack off-screen, so
							the container is re-anchored to the centre and scaled to fit.
							The overrides live here rather than in card-swap.tsx to keep
							that file a clean port. */}
							<div
								className={[
									"relative lg:col-span-7",
									"h-[360px] sm:h-[440px] lg:h-[480px]",
									"[&>div]:!left-1/2 [&>div]:!right-auto [&>div]:!origin-center",
									"[&>div]:!translate-x-[-50%] [&>div]:!translate-y-[-50%]",
									"[&>div]:!top-1/2 [&>div]:!bottom-auto",
									"[&>div]:!scale-[0.62] sm:[&>div]:!scale-[0.82]",
									"lg:[&>div]:!top-auto lg:[&>div]:!bottom-0",
									"lg:[&>div]:!left-auto lg:[&>div]:!right-0",
									"lg:[&>div]:!origin-bottom-right lg:[&>div]:!scale-100",
									"lg:[&>div]:!translate-x-[5%] lg:[&>div]:!translate-y-[20%]",
								].join(" ")}
							>
								<CardSwap
									width={460}
									height={380}
									cardDistance={55}
									verticalDistance={65}
									delay={4500}
									pauseOnHover
									skewAmount={5}
								>
									{events.map((evt) => (
										<Card
											key={evt.id}
											customClass="border-white/10 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl"
										>
											<EventCardBody evt={evt} />
										</Card>
									))}
								</CardSwap>
							</div>
						</>
					)}
				</div>
			</div>
		</section>
	);
}

function EventCardBody({ evt }: { evt: SampleEvent }) {
	return (
		<div className="flex h-full flex-col text-left text-white">
			<div className="flex items-center justify-between border-b border-white/10 pb-4">
				<div className="flex items-center gap-2">
					<span className="rounded-md bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
						{evt.category}
					</span>
					<span className="flex items-center gap-1 text-xs text-emerald-400">
						<CheckCircle2 className="size-3.5" />
						{evt.escrowStatus}
					</span>
				</div>
				<span className="font-mono text-sm font-bold">{evt.prizePool}</span>
			</div>

			<div className="mt-4">
				<h3 className="text-xl font-bold">{evt.title}</h3>
				<p className="mt-1 text-xs text-zinc-400">
					{evt.participants} verified builders registered
				</p>
			</div>

			<div className="mt-5 space-y-2 rounded-xl border border-white/5 bg-black/40 p-3.5 font-mono text-xs">
				<p className="font-sans text-[10px] tracking-wider text-zinc-400 uppercase">
					Escrow Milestones
				</p>
				{evt.milestones.map((m) => (
					<div
						key={m}
						className="flex items-center justify-between text-zinc-300"
					>
						<span>{m}</span>
					</div>
				))}
			</div>

			<div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4 text-xs text-zinc-400">
				<div className="flex flex-col gap-0.5">
					<span className="font-sans text-[10px] tracking-wider text-amber-400/90 uppercase">
						Illustrative example (not a live tx)
					</span>
					<span className="font-mono">Tx: {evt.txHash}</span>
				</div>
				<span className="flex items-center gap-1 text-blue-400">
					View on Stellar Explorer <ExternalLink className="size-3" />
				</span>
			</div>
		</div>
	);
}
