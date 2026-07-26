import { LightPillarBackground } from "@/components/light-pillar-background";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export default function Home() {
	return (
		<main className="relative isolate flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-black px-6 py-24 text-center">
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
			{/* The pillar's brightest column can pass directly behind this text
			(it's animated and moves), so a translucent dark panel guarantees
			legibility instead of relying on text-shadow against a background
			that sometimes goes near-white. */}
			<div className="relative z-10 flex flex-col items-center gap-6 rounded-3xl bg-black/40 px-8 py-10 backdrop-blur-md">
				<h1 className="text-4xl font-semibold tracking-tight text-white">
					Astrea
				</h1>
				<p className="max-w-md text-lg text-white/80">
					Escrow-backed prize payouts for hackathons, bounties, and community
					challenges — funds locked on-chain before the event starts.
				</p>
				<WalletConnectButton className="bg-white text-black hover:bg-white/90" />
				<p className="text-sm text-white/70">
					MVP in active development. See the{" "}
					<a
						className="underline underline-offset-4 hover:text-white"
						href="https://github.com/Astrea-Payouts/astrea/blob/main/docs/build-plan.md"
					>
						build plan
					</a>{" "}
					for what&apos;s next.
				</p>
			</div>
		</main>
	);
}
