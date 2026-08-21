import { useTranslations } from "next-intl";
import { PrismBackground } from "@/components/prism-background";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export default function Home() {
	const t = useTranslations("HomePage");

	return (
		<main className="relative isolate flex min-h-screen flex-1 flex-col overflow-hidden bg-black">
			{/* Canvas spans the full hero (no flat black slab on the left) —
			the shape itself is pushed right via `offset` so it still reads
			as concentrated on the right side. */}
			<div className="pointer-events-none absolute inset-0 z-0">
				<PrismBackground
					suspendWhenOffscreen
					offset={{ x: 260 }}
					className="h-full w-full"
				/>
			</div>
			{/* Fully transparent by ~60% width, i.e. exactly where the Prism
			lane starts — the glow must stay undimmed to read like the docs
			demo; only the text column underneath needs the contrast. */}
			<div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(115deg,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.8)_25%,rgba(0,0,0,0.4)_45%,rgba(0,0,0,0)_60%)]" />

			<div className="relative z-10 flex flex-1 items-center px-6 py-24 md:px-12">
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
					<div className="flex flex-wrap items-center gap-5">
						<WalletConnectButton className="bg-white text-black hover:bg-white/90" />
						<p className="text-sm text-white/55">
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
			</div>
		</main>
	);
}
