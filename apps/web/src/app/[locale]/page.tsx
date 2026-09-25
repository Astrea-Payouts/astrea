import { ArrowRight, Code2, Sparkles, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { HeroPrism } from "@/components/marketing/hero-prism";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SeeItInAction } from "@/components/marketing/see-it-in-action";
import { SpecularButton } from "@/components/marketing/specular-button";
import { ThemedBorderGlow } from "@/components/marketing/themed-border-glow";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";

export default function Home() {
	const t = useTranslations("HomePage");

	return (
		<main className="relative isolate flex min-h-screen flex-1 flex-col overflow-hidden bg-white dark:bg-black">
			{/* Hero Section */}
			<section className="relative flex min-h-svh flex-col justify-center overflow-hidden">
				{/* Canvas fills the whole viewport-tall hero. The offset is kept
				small so the glow still spreads across the full width instead of
				leaving a flat black slab on the left. In light mode the prism
				draws itself as ink on gray-400 (see prism-background.tsx). */}
				<div className="pointer-events-none absolute inset-0 z-0">
					<HeroPrism />
				</div>
				{/* Readability scrim for the text column only. It has to fade out
				well before the glow's core, otherwise the left half reads as dead
				black rather than as part of the same background. Light mode uses
				the canvas's own gray-400 (153 161 175) so the column reads as
				flat gray instead of a dark smear over the prism. */}
				<div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(105deg,rgba(153,161,175,0.9)_0%,rgba(153,161,175,0.65)_22%,rgba(153,161,175,0.25)_40%,rgba(153,161,175,0)_58%)] dark:bg-[linear-gradient(105deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.65)_22%,rgba(0,0,0,0.25)_40%,rgba(0,0,0,0)_58%)]" />
				{/* Blends the hero into the section below so the seam isn't a hard
				edge between the glow and the flat page background. */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-32 bg-gradient-to-b from-transparent to-white dark:to-black" />

				<div className="relative z-10 flex flex-1 items-center px-6 py-28 md:px-12">
					<div className="max-w-xl">
						<p className="mb-5 text-xs font-semibold tracking-[0.14em] text-zinc-950/70 uppercase dark:text-white/55">
							{t("eyebrow")}
						</p>
						<h1 className="mb-6 font-serif text-5xl leading-[1.02] font-bold text-zinc-950 md:text-6xl dark:text-white">
							{t("title")}
						</h1>
						<p className="mb-9 max-w-md text-lg leading-relaxed text-zinc-900/80 dark:text-white/70">
							{t("tagline")}
						</p>
						<div className="flex flex-wrap items-center gap-4">
							<Link href="/organizer">
								<SpecularButton
									size="lg"
									tint="#000000"
									tintOpacity={1}
									lightTint="#ffffff"
									lightTextColor="#09090b"
									lightBaseColor="#3f3f46"
								>
									<span>{t("createEventCta")}</span>
								</SpecularButton>
							</Link>
							<WalletConnectButton />
						</div>
						<p className="mt-6 text-sm text-zinc-950/70 dark:text-white/55">
							{t.rich("mvpNotice", {
								link: (chunks) => (
									<a
										className="text-zinc-950 underline underline-offset-4 hover:text-black dark:text-white/85 dark:hover:text-white"
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
			<section className="relative z-10 border-y border-border bg-zinc-100/80 px-6 py-12 backdrop-blur-md md:px-12 md:py-16 dark:bg-zinc-950/80">
				<div className="mx-auto max-w-5xl">
					<div className="text-center">
						<p className="text-xs font-semibold tracking-wider text-blue-600 uppercase dark:text-blue-400">
							{t("audienceEyebrow")}
						</p>
						<h2 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
							{t("audienceTitle")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("audienceSubtitle")}
						</p>
					</div>

					{/* ThemedBorderGlow, not BorderGlowInView: BorderGlow needs its
					surface colour as a hex string in JS, so the wrapper picks it from
					the theme. The text inside uses dark: variants, which the browser
					resolves from the <html> class before React hydrates. */}
					<div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
						{/* Participant Option */}
						<ThemedBorderGlow
							borderRadius={16}
							glowColor="217 91 60"
							colors={["#3b82f6", "#60a5fa", "#38bdf8"]}
							className="group"
						>
							<Link href="/participant" className="block p-8">
								<div className="flex items-center justify-between">
									<div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400">
										<Code2 className="size-6" />
									</div>
									<ArrowRight className="size-5 text-zinc-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-blue-600 dark:text-zinc-400 dark:group-hover:text-blue-400" />
								</div>
								<h3 className="mt-6 text-xl font-bold text-zinc-950 dark:text-white">
									{t("participantRoleTitle")}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
									{t("participantRoleDesc")}
								</p>
								<span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
									{t("participantRoleAction")} <ArrowRight className="size-3" />
								</span>
							</Link>
						</ThemedBorderGlow>

						{/* Organizer Option */}
						<ThemedBorderGlow
							borderRadius={16}
							glowColor="160 84 55"
							colors={["#10b981", "#34d399", "#6ee7b7"]}
							className="group"
						>
							<Link href="/organizer" className="block p-8">
								<div className="flex items-center justify-between">
									<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
										<Users className="size-6" />
									</div>
									<ArrowRight className="size-5 text-zinc-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-emerald-600 dark:text-zinc-400 dark:group-hover:text-emerald-400" />
								</div>
								<h3 className="mt-6 text-xl font-bold text-zinc-950 dark:text-white">
									{t("organizerRoleTitle")}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
									{t("organizerRoleDesc")}
								</p>
								<span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
									{t("organizerRoleAction")} <ArrowRight className="size-3" />
								</span>
							</Link>
						</ThemedBorderGlow>
					</div>
				</div>
			</section>

			{/* See It In Action (Card Swap) */}
			<SeeItInAction />

			{/* How It Works (Scroll Stack) */}
			<HowItWorks />

			{/* Final CTA Section */}
			<section className="relative overflow-hidden bg-gradient-to-t from-blue-100 via-zinc-50 to-white px-6 py-16 text-center md:py-20 dark:from-blue-950/30 dark:via-zinc-950 dark:to-black">
				<div className="mx-auto max-w-3xl">
					<div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
						<Sparkles className="size-3.5" />
						<span>{t("finalCtaBadge")}</span>
					</div>
					<h2 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl">
						{t("finalCtaTitle")}
					</h2>
					<p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
						{t("finalCtaDesc")}
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-4">
						<Link href="/organizer">
							<SpecularButton
								size="lg"
								tint="#000000"
								tintOpacity={1}
								lightTint="#ffffff"
								lightTextColor="#09090b"
								lightBaseColor="#18181b"
							>
								<span>{t("createEventCta")}</span>
							</SpecularButton>
						</Link>
						<Link
							href="/participant"
							className="rounded-full border border-zinc-900/15 bg-zinc-900/5 px-6 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-900/10 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
						>
							{t("browseBountiesCta")}
						</Link>
					</div>
				</div>
			</section>
		</main>
	);
}
