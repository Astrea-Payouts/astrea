"use client";

import { gsap } from "gsap";
import {
	CheckCircle2,
	Coins,
	ExternalLink,
	ShieldCheck,
	Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

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
	const containerRef = useRef<HTMLDivElement>(null);
	const cardsRef = useRef<(HTMLButtonElement | null)[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const [isPaused, setIsPaused] = useState(false);

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

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const onEnter = () => setIsPaused(true);
		const onLeave = () => setIsPaused(false);

		container.addEventListener("mouseenter", onEnter);
		container.addEventListener("mouseleave", onLeave);

		return () => {
			container.removeEventListener("mouseenter", onEnter);
			container.removeEventListener("mouseleave", onLeave);
		};
	}, []);

	useEffect(() => {
		if (isPaused) return;

		const interval = setInterval(() => {
			setActiveIndex((prev) => (prev + 1) % events.length);
		}, 3800);

		return () => clearInterval(interval);
	}, [isPaused, events.length]);

	useEffect(() => {
		cardsRef.current.forEach((card, idx) => {
			if (!card) return;

			// Calculate offset relative to activeIndex
			const diff = (idx - activeIndex + events.length) % events.length;

			if (diff === 0) {
				// Front active card
				gsap.to(card, {
					scale: 1,
					y: 0,
					z: 0,
					opacity: 1,
					rotationX: 0,
					duration: 0.6,
					ease: "power2.out",
					zIndex: 30,
				});
			} else if (diff === 1) {
				// Second card
				gsap.to(card, {
					scale: 0.94,
					y: 20,
					z: -40,
					opacity: 0.75,
					rotationX: -4,
					duration: 0.6,
					ease: "power2.out",
					zIndex: 20,
				});
			} else {
				// Third / background card
				gsap.to(card, {
					scale: 0.88,
					y: 40,
					z: -80,
					opacity: 0.45,
					rotationX: -8,
					duration: 0.6,
					ease: "power2.out",
					zIndex: 10,
				});
			}
		});
	}, [activeIndex, events.length]);

	return (
		<section className="relative overflow-hidden bg-zinc-950 py-24 text-white">
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

						{/* Interactive indicators */}
						<div className="mt-8 flex items-center gap-2">
							{events.map((evt, idx) => (
								<button
									key={`indicator-${evt.id}`}
									type="button"
									onClick={() => setActiveIndex(idx)}
									className={`h-2 rounded-full transition-all duration-300 ${
										activeIndex === idx
											? "w-8 bg-blue-500"
											: "w-2 bg-white/20 hover:bg-white/40"
									}`}
									aria-label={`Slide ${idx + 1}`}
								/>
							))}
						</div>
					</div>

					<div
						ref={containerRef}
						className="relative flex h-[420px] items-center justify-center perspective-[1000px] lg:col-span-7"
					>
						{events.map((evt, idx) => (
							<button
								key={`card-${evt.id}`}
								type="button"
								ref={(el) => {
									cardsRef.current[idx] = el;
								}}
								onClick={() =>
									setActiveIndex((prev) => (prev + 1) % events.length)
								}
								className="absolute w-full max-w-lg text-left cursor-pointer rounded-2xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl transition-colors duration-300 hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
							>
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
									<span className="font-mono text-sm font-bold text-white">
										{evt.prizePool}
									</span>
								</div>

								<div className="mt-4">
									<h3 className="text-xl font-bold text-white">{evt.title}</h3>
									<p className="mt-1 text-xs text-zinc-400">
										{evt.participants} verified builders registered
									</p>
								</div>

								<div className="mt-5 space-y-2 rounded-xl bg-black/40 p-3.5 border border-white/5 font-mono text-xs">
									<p className="text-[10px] uppercase tracking-wider text-zinc-400 font-sans">
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

								<div className="mt-5 flex items-center justify-between pt-2 text-xs text-zinc-400 border-t border-white/5">
									<span className="font-mono">Tx: {evt.txHash}</span>
									<span className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
										View on Stellar Explorer <ExternalLink className="size-3" />
									</span>
								</div>
							</button>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
