import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { env } from "@/lib/env";
import { getSessionWallet } from "@/lib/wallet/session";
import { EventForm } from "./event-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("OrganizerNew");
	return { title: t("title") };
}

// Step 1 of the organizer path (#15 PR B1): the draft lives only in
// Postgres. Funding and create_event happen on /organizer/events/[id]/fund.
export default async function NewEventPage() {
	const t = await getTranslations("OrganizerNew");
	const session = await getSessionWallet();

	return (
		<main className="min-h-screen bg-black text-white pt-28 pb-16 px-4 sm:px-6 md:py-12 md:px-12">
			<div className="mx-auto max-w-2xl flex flex-col gap-6">
				<header className="flex flex-col gap-2">
					<h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
						{t("title")}
					</h1>
					<p className="text-sm text-zinc-400">{t("intro")}</p>
				</header>

				{session ? (
					<EventForm
						organizerAddress={session.address}
						symbol={env.USDC_SYMBOL}
					/>
				) : (
					<section className="rounded-2xl border border-emerald-500/20 bg-zinc-900/40 p-5 flex flex-col gap-3">
						<p className="text-sm text-zinc-300">{t("connect")}</p>
						<WalletConnectButton className="w-full sm:w-auto" />
					</section>
				)}
			</div>
		</main>
	);
}
