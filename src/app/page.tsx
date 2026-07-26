import { PrismBackground } from "@/components/prism-background";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export default function Home() {
	return (
		<main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-6 py-24 text-center">
			<PrismBackground
				suspendWhenOffscreen
				className="pointer-events-none absolute inset-0 -z-10"
			/>
			<h1 className="text-4xl font-semibold tracking-tight">Astrea</h1>
			<p className="max-w-md text-lg text-muted-foreground">
				Escrow-backed prize payouts for hackathons, bounties, and community
				challenges — funds locked on-chain before the event starts.
			</p>
			<WalletConnectButton />
			<p className="text-sm text-muted-foreground">
				MVP in active development. See the{" "}
				<a
					className="underline underline-offset-4 hover:text-foreground"
					href="https://github.com/Astrea-Payouts/astrea/blob/main/docs/build-plan.md"
				>
					build plan
				</a>{" "}
				for what&apos;s next.
			</p>
		</main>
	);
}
