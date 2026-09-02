import { ArrowRight, Code2, Sparkles, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SeeItInAction } from "@/components/marketing/see-it-in-action";
import { SpecularButton } from "@/components/marketing/specular-button";
import { PrismBackground } from "@/components/prism-background";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";

export default function Home() {
	const t = useTranslations("HomePage");

	return (
		<main className="relative isolate flex min-h-screen flex-1 flex-col overflow-hidden bg-black">
			{/* Hero Section */}
			<section className="relative flex min-h-svh flex-col justify-center overflow-hidden">
				{/* Canvas fills the whole viewport-tall hero. The offset is kept
				small so the glow still spreads across the full width instead of
				leaving a flat black slab on the left. */}
				<div className="pointer-events-none absolute inset-0 z-0">
					<PrismBackground
						suspendWhenOffscreen
						offset={{ x: 90 }}
						className="h-full w-full"
					/>
				</div>
				{/* Readability scrim for the text column only. It has to fade out
				well before the glow's core, otherwise the left half reads as dead
				black rather than as part of the same background. */}
				<div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(105deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.65)_22%,rgba(0,0,0,0.25)_40%,rgba(0,0,0,0)_58%)]" />
				{/* Blends the hero into the section below so the seam isn't a hard
				edge between the glow and flat black. */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-32 bg-gradient-to-b from-transparent to-black" />

				<div className="relative z-10 flex flex-1 items-center px-6 py-28 md:px-12">
					<div className="max-w-xl">
						<p className="mb-5 text-xs font-semibold tracking-[0.14em] text-white/55 uppercase">
							{t("eyebrow")}
						</p>
						<h1 className="mb-6 font-serif text-5xl leading-[1.02] font-bold text-white md:text-6xl">
							{t("title")}
						</h1>
						<p className="mb-9 max-w-md text-lg leading-relaxed text-white/70">
							{t("tagline")}
						</p>
						<div className="flex flex-wrap items-center gap-4">
							<Link href="/organizer">
								<SpecularButton size="lg">
									<span>{t("createEventCta")}</span>
								</SpecularButton>
							</Link>
							<WalletConnectButton className="bg-white text-black hover:bg-white/90" />
						</div>
						<p className="mt-6 text-sm text-white/55">
							{t.rich("mvpNotice", {
								link: (chunks) => (
									<a
										className="text-white/85 underline underline-offset-4 hover:text-white"
										href="https://github.com/Astrea-Payouts/astrea/blob/main/docs/build-plan.md"
									>
										{chunks}
									</a>
								),
							})}
						</p>
					</div>
				</div>
			</section>

			{/* Participant vs Organizer Audience Question Section */}
			<section className="relative z-10 border-y border-white/10 bg-zinc-950/80 px-6 py-16 backdrop-blur-md md:px-12">
				<div className="mx-auto max-w-5xl">
					<div className="text-center">
						<p className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
							{t("audienceEyebrow")}
						</p>
						<h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
							{t("audienceTitle")}
						</h2>
						<p className="mt-2 text-sm text-zinc-400">
							{t("audienceSubtitle")}
						</p>
					</div>

					<div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
						{/* Participant Option */}
						<Link
							href="/participant"
							className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-[0_0_0_0_rgba(59,130,246,0)] transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/50 hover:bg-blue-500/[0.04] hover:shadow-[0_0_28px_-4px_rgba(59,130,246,0.45)]"
						>
							{/* Glow that tracks the border itself, so the hover state
							reads as the edge lighting up rather than the whole card
							changing tint. */}
							<span
								aria-hidden
								className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(120%_80%_at_50%_0%,rgba(59,130,246,0.16),transparent_60%)]"
							/>
							<div className="relative flex items-center justify-between">
								<div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-400">
									<Code2 className="size-6" />
								</div>
								<ArrowRight className="size-5 text-zinc-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-blue-400" />
							</div>
							<h3 className="relative mt-6 text-xl font-bold text-white group-hover:text-blue-300">
								{t("participantRoleTitle")}
							</h3>
							<p className="relative mt-2 text-sm leading-relaxed text-zinc-400">
								{t("participantRoleDesc")}
							</p>
							<span className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400">
								{t("participantRoleAction")} <ArrowRight className="size-3" />
							</span>
						</Link>

						{/* Organizer Option */}
						<Link
							href="/organizer"
							className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-[0_0_0_0_rgba(16,185,129,0)] transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] hover:shadow-[0_0_28px_-4px_rgba(16,185,129,0.45)]"
						>
							<span
								aria-hidden
								className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(120%_80%_at_50%_0%,rgba(16,185,129,0.16),transparent_60%)]"
							/>
							<div className="relative flex items-center justify-between">
								<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
									<Users className="size-6" />
								</div>
								<ArrowRight className="size-5 text-zinc-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-emerald-400" />
							</div>
							<h3 className="relative mt-6 text-xl font-bold text-white group-hover:text-emerald-300">
								{t("organizerRoleTitle")}
							</h3>
							<p className="relative mt-2 text-sm leading-relaxed text-zinc-400">
								{t("organizerRoleDesc")}
							</p>
							<span className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
								{t("organizerRoleAction")} <ArrowRight className="size-3" />
							</span>
						</Link>
					</div>
				</div>
			</section>

			{/* See It In Action (Card Swap) */}
			<SeeItInAction />

			{/* How It Works (Scroll Stack) */}
			<HowItWorks />

			{/* Final CTA Section */}
			<section className="relative overflow-hidden bg-gradient-to-t from-blue-950/30 via-zinc-950 to-black py-24 text-center px-6">
				<div className="mx-auto max-w-3xl">
					<div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1 text-xs font-semibold text-blue-400">
						<Sparkles className="size-3.5" />
						<span>{t("finalCtaBadge")}</span>
					</div>
					<h2 className="mt-6 font-serif text-4xl font-bold text-white md:text-5xl">
						{t("finalCtaTitle")}
					</h2>
					<p className="mt-4 text-lg text-zinc-400 max-w-xl mx-auto">
						{t("finalCtaDesc")}
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-4">
						<Link href="/organizer">
							<SpecularButton size="lg">
									<span>{t("createEventCta")}</span>
								</SpecularButton>
						</Link>
						<Link
							href="/participant"
							className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
						>
							{t("browseBountiesCta")}
						</Link>
					</div>
				</div>
			</section>
		</main>
	);
}
