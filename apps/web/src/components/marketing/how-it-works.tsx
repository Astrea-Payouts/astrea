"use client";

import Lenis from "lenis";
import { Check, Gavel, Layers, Send, Sparkles, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

export function HowItWorks() {
	const t = useTranslations("HowItWorks");
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let lenis: Lenis | null = null;
		let rafId: number;

		try {
			lenis = new Lenis({
				duration: 1.2,
				easing: (val) => Math.min(1, 1.001 - 2 ** (-10 * val)),
				orientation: "vertical",
				gestureOrientation: "vertical",
				smoothWheel: true,
			});

			const raf = (time: number) => {
				lenis?.raf(time);
				rafId = requestAnimationFrame(raf);
			};
			rafId = requestAnimationFrame(raf);
		} catch (e) {
			console.warn("Lenis smooth-scroll initialization skipped:", e);
		}

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			lenis?.destroy();
		};
	}, []);

	const steps = [
		{
			id: "step-wizard",
			number: "01",
			title: t("step1Title"),
			description: t("step1Desc"),
			badge: "Step 1: Wizard",
			icon: <Layers className="size-6 text-blue-400" />,
			details: [
				"Customizable prize tiers (Ranked & Category bounties)",
				"Appointed judges and fallback dispute resolver",
				"Configurable milestone release percentages",
			],
			border: "border-blue-500/30",
		},
		{
			id: "step-escrow",
			number: "02",
			title: t("step2Title"),
			description: t("step2Desc"),
			badge: "Step 2: Smart Escrow",
			icon: <Wallet className="size-6 text-emerald-400" />,
			details: [
				"Locked in Soroban multi-milestone escrow contract",
				"Instant 'Prizes Verified On-Chain' public badge",
				"Zero trust needed — organizers cannot pull funds unilaterally",
			],
			border: "border-emerald-500/30",
		},
		{
			id: "step-judging",
			number: "03",
			title: t("step3Title"),
			description: t("step3Desc"),
			badge: "Step 3: Verifiable Judging",
			icon: <Gavel className="size-6 text-indigo-400" />,
			details: [
				"Multi-judge scoring and rubric assessment",
				"Transparent audit trail preserved in Postgres and OpLog",
				"Automated dispute handling if milestone criteria disputed",
			],
			border: "border-indigo-500/30",
		},
		{
			id: "step-payout",
			number: "04",
			title: t("step4Title"),
			description: t("step4Desc"),
			badge: "Step 4: Payout",
			icon: <Send className="size-6 text-sky-400" />,
			details: [
				"Trustline-verified automated USDC transfer",
				"Instant settlement via Stellar Horizon RPC",
				"Public transaction hash and explorer link per prize",
			],
			border: "border-sky-500/30",
		},
	];

	return (
		<section ref={containerRef} className="relative bg-black py-28 text-white">
			<div className="mx-auto max-w-5xl px-6 md:px-12">
				<div className="text-center">
					<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-semibold text-white/70">
						<Sparkles className="size-3.5 text-blue-400" />
						<span>{t("badge")}</span>
					</div>
					<h2 className="mt-4 font-serif text-3xl font-bold tracking-tight md:text-5xl">
						{t("title")}
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400 md:text-lg">
						{t("subtitle")}
					</p>
				</div>

				<div className="mt-20 space-y-8">
					{steps.map((step, idx) => (
						<div
							key={step.id}
							className={`sticky top-24 rounded-3xl border ${step.border} bg-zinc-950/95 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 md:p-10`}
							style={{ top: `${96 + idx * 20}px` }}
						>
							<div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
								<div className="max-w-xl">
									<div className="flex items-center gap-3">
										<span className="font-mono text-2xl font-black text-blue-400/80">
											{step.number}
										</span>
										<span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-medium text-white/80">
											{step.badge}
										</span>
									</div>
									<h3 className="mt-4 text-2xl font-bold text-white md:text-3xl">
										{step.title}
									</h3>
									<p className="mt-3 text-base leading-relaxed text-zinc-400">
										{step.description}
									</p>

									<div className="mt-6 space-y-2.5">
										{step.details.map((detail) => (
											<div
												key={detail}
												className="flex items-center gap-2.5 text-sm text-zinc-300"
											>
												<div className="flex size-4.5 items-center justify-center rounded-full bg-white/10 text-white">
													<Check className="size-3" />
												</div>
												<span>{detail}</span>
											</div>
										))}
									</div>
								</div>

								<div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 md:size-28">
									{step.icon}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
