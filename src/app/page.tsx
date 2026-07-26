import { PrismBackground } from "@/components/prism-background";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export default function Home() {
	return (
		<main className="relative isolate flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-black px-6 py-24 text-center">
			<PrismBackground
				transparent={false}
				suspendWhenOffscreen
				className="pointer-events-none absolute inset-0 z-0"
			/>
			<h1 className="relative z-10 text-4xl font-semibold tracking-tight text-white">
				Astrea
			</h1>
			<p className="relative z-10 max-w-md text-lg text-white/70">
				Escrow-backed prize payouts for hackathons, bounties, and community
				challenges — funds locked on-chain before the event starts.
			</p>
			<WalletConnectButton className="relative z-10 bg-white text-black hover:bg-white/90" />
			<p className="relative z-10 text-sm text-white/60">
				MVP in active development. See the{" "}
				<a
					className="underline underline-offset-4 hover:text-white"
					href="https://github.com/Astrea-Payouts/astrea/blob/main/docs/build-plan.md"
				>
					build plan
				</a>{" "}
				for what&apos;s next.
			</p>
		</main>
	);
}
