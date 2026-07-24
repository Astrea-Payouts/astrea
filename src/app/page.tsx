export default function Home() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
			<h1 className="text-3xl font-semibold tracking-tight">Astrea</h1>
			<p className="max-w-md text-muted-foreground">
				Escrow-backed prize payouts for hackathons, bounties, and community
				challenges — funds locked on-chain before the event starts.
			</p>
			<p className="text-sm text-muted-foreground">
				MVP in active development. See the{" "}
				<a
					className="underline underline-offset-4"
					href="https://github.com/Astrea-Payouts"
				>
					build plan
				</a>{" "}
				for what&apos;s next.
			</p>
		</div>
	);
}
