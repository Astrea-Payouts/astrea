import { LightPillarBackground } from "@/components/light-pillar-background";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export default function Home() {
	return (
		<main className="relative isolate flex flex-1 overflow-hidden bg-black">
			<LightPillarBackground
				topColor="#b3b1ba"
				bottomColor="#ffffff"
				intensity={1.0}
				rotationSpeed={0.3}
				glowAmount={0.005}
				pillarWidth={3.0}
				pillarHeight={0.4}
				noiseIntensity={0.5}
				pillarRotation={0}
				interactive={false}
				mixBlendMode="normal"
				className="pointer-events-none z-0"
			/>
			{/* The pillar is unobstructed and animated, so it can pass bright light
			directly behind the floating header's logo/icons at any moment — this
			scrim guarantees header contrast without covering the effect anywhere
			the header itself doesn't reach. */}
			<div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-24 bg-gradient-to-b from-black/70 to-transparent" />
			{/* Text lives in a solid panel on one side, offset below the floating
			header, so the pillar stays fully visible and unobstructed everywhere
			else — the whole point of the effect is to be seen. */}
			<div className="relative z-10 flex w-full flex-1 flex-col md:flex-row">
				<div className="mt-24 flex w-full flex-col justify-center gap-6 bg-white px-8 pb-16 text-left md:w-[42%] md:px-16 md:pt-24 md:pb-24">
					<h1 className="text-4xl font-semibold tracking-tight text-black">
						Astrea
					</h1>
					<p className="max-w-md text-lg text-black/70">
						Escrow-backed prize payouts for hackathons, bounties, and community
						challenges — funds locked on-chain before the event starts.
					</p>
					<WalletConnectButton className="self-start bg-black text-white hover:bg-black/80" />
					<p className="text-sm text-black/60">
						MVP in active development. See the{" "}
						<a
							className="underline underline-offset-4 hover:text-black"
							href="https://github.com/Astrea-Payouts/astrea/blob/main/docs/build-plan.md"
						>
							build plan
						</a>{" "}
						for what&apos;s next.
					</p>
				</div>
				<div className="md:w-[58%]" />
			</div>
		</main>
	);
}
