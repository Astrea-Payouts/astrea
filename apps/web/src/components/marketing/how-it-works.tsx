"use client";

import { Check, Gavel, Layers, Send, Sparkles, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import {
	ScrollStack,
	ScrollStackItem,
} from "@/components/marketing/scroll-stack";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface Step {
	id: string;
	number: string;
	title: string;
	description: string;
	badge: string;
	icon: ReactNode;
	details: string[];
	itemClassName: string;
}

// Passed to ScrollStack below AND used to size its pin runway, so the two can
// never drift apart. ITEM_SCALE is the component's own default.
const ITEM_DISTANCE = 80;
const ITEM_STACK_DISTANCE = 28;
const STACK_POSITION = 0.18; // fraction of viewport height
const BASE_SCALE = 0.88;
const ITEM_SCALE = 0.03;

// Breathing room we want left between the last card and the next section.
const TARGET_GAP = 56;

export function HowItWorks() {
	const t = useTranslations("HowItWorks");
	const reduced = useReducedMotion();
	const stackRef = useRef<HTMLDivElement>(null);

	// ScrollStack fakes its pin with translateY, so the last card is painted far
	// below its own layout box and the track needs bottom runway or the card
	// spills into the CTA section. The leftover gap works out to
	//   runway + vh/2 - stackPosition*vh - itemStackDistance*(n-1) - cardHeight
	// (the vh/2 is the component releasing the pin once .scroll-stack-end
	// reaches mid-viewport), so solving that for TARGET_GAP gives the runway.
	//
	// cardHeight has to be measured, not assumed: the same card is ~332px tall
	// in the desktop row layout and ~529px once it wraps at 375px. A hard-coded
	// calc() tuned on desktop overlapped the CTA section by 135px on mobile.
	const syncRunway = useCallback(() => {
		const el = stackRef.current;
		const cards = el?.querySelectorAll<HTMLElement>(".scroll-stack-card");
		const last = cards?.[cards.length - 1];
		if (!el || !cards || !last) return;

		// offsetHeight is layout height, so it ignores the scale transform the
		// component has already written onto the card.
		const scale = BASE_SCALE + (cards.length - 1) * ITEM_SCALE;
		const runway =
			TARGET_GAP +
			last.offsetHeight * scale +
			ITEM_STACK_DISTANCE * (cards.length - 1) -
			window.innerHeight * (0.5 - STACK_POSITION);

		el.style.setProperty(
			"--stack-runway",
			`${Math.max(32, Math.round(runway))}px`,
		);
	}, []);

	useEffect(() => {
		// Nothing to size when the static list is rendered instead.
		if (reduced) return;
		syncRunway();
		const el = stackRef.current;
		if (!el) return;
		const observer = new ResizeObserver(syncRunway);
		observer.observe(el);
		window.addEventListener("resize", syncRunway);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", syncRunway);
		};
	}, [syncRunway, reduced]);

	const steps: Step[] = [
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
			itemClassName: "border border-blue-500/30 bg-zinc-950 text-white",
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
			itemClassName: "border border-emerald-500/30 bg-zinc-950 text-white",
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
			itemClassName: "border border-indigo-500/30 bg-zinc-950 text-white",
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
			itemClassName: "border border-sky-500/30 bg-zinc-950 text-white",
		},
	];

	return (
		<section className="relative bg-black pt-1 pb-0 text-white md:pt-16">
			<div className="mx-auto max-w-5xl px-3 md:px-12">
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

				{reduced ? (
					/* Reduced motion: the same four cards as a plain list. ScrollStack
					is scroll-driven — it translates each card hundreds of pixels and
					installs Lenis, which replaces the browser's own scrolling for the
					whole page. Both are Tier 1 under the policy in docs/ui-motion.md,
					and neither survives being "damped": the pin only reads as a stack
					because the cards move. So the section drops the choreography and
					keeps the content. */
					<ol className="mt-10 space-y-6">
						{steps.map((step) => (
							<li
								key={step.id}
								className={`${step.itemClassName} rounded-3xl p-8 shadow-2xl md:p-10`}
							>
								<StepCardBody step={step} />
							</li>
						))}
					</ol>
				) : (
					/* ScrollStack ships as its own scroll container (root is
					`h-full overflow-y-auto`, inner track carries a pt-[20vh] /
					pb-[50rem] pin runway). Used that way it needs a bounded parent
					height and becomes a nested scroll area — with overscroll-behavior
					contain the page stops scrolling while the pointer is over it,
					which traps visitors on a marketing page.

					So we drive it from window scroll instead and replace the inner
					track's own padding here: left alone, that 50rem lands in page
					flow as dead black after the last card. --stack-runway is measured
					by syncRunway above; the fallback only applies before the first
					effect run. The overrides live at the call site so
					scroll-stack.tsx stays a faithful port. */
					<div
						ref={stackRef}
						className="mt-10 [&_.scroll-stack-inner]:!min-h-0 [&_.scroll-stack-inner]:!px-0 [&_.scroll-stack-inner]:!pt-[8vh] [&_.scroll-stack-inner]:!pb-[var(--stack-runway,16rem)]"
					>
						<ScrollStack
							useWindowScroll
							itemDistance={ITEM_DISTANCE}
							itemStackDistance={ITEM_STACK_DISTANCE}
							stackPosition={`${STACK_POSITION * 100}%`}
							baseScale={BASE_SCALE}
						>
							{steps.map((step) => (
								<ScrollStackItem
									key={step.id}
									itemClassName={`${step.itemClassName} !h-auto !rounded-3xl !p-8 md:!p-10 shadow-2xl`}
								>
									<StepCardBody step={step} />
								</ScrollStackItem>
							))}
						</ScrollStack>
					</div>
				)}
			</div>
		</section>
	);
}

function StepCardBody({ step }: { step: Step }) {
	return (
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
	);
}
