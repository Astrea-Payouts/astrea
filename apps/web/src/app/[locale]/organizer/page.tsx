import { ArrowRight, CheckCircle2, Coins, Layers, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";

export default function OrganizerPage() {
	const t = useTranslations("OrganizerPage");

	return (
		<main className="min-h-screen bg-white px-6 py-16 text-zinc-950 md:px-12 dark:bg-black dark:text-white">
			<div className="mx-auto max-w-4xl">
				<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
					<Coins className="size-3.5" />
					<span>{t("badge")}</span>
				</div>

				<h1 className="mt-5 font-serif text-4xl font-bold tracking-tight md:text-5xl">
					{t("title")}
				</h1>
				<p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
					{t("tagline")}
				</p>

				<div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
					<div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
						<div className="w-fit rounded-lg bg-emerald-500/10 p-2.5 text-emerald-700 dark:text-emerald-400">
							<Layers className="size-5" />
						</div>
						<h3 className="mt-4 text-lg font-bold">{t("card1Title")}</h3>
						<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
							{t("card1Desc")}
						</p>
					</div>

					<div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
						<div className="w-fit rounded-lg bg-blue-500/10 p-2.5 text-blue-700 dark:text-blue-400">
							<Users className="size-5" />
						</div>
						<h3 className="mt-4 text-lg font-bold">{t("card2Title")}</h3>
						<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
							{t("card2Desc")}
						</p>
					</div>

					<div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
						<div className="w-fit rounded-lg bg-sky-500/10 p-2.5 text-sky-700 dark:text-sky-400">
							<CheckCircle2 className="size-5" />
						</div>
						<h3 className="mt-4 text-lg font-bold">{t("card3Title")}</h3>
						<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
							{t("card3Desc")}
						</p>
					</div>
				</div>

				<div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-100 via-zinc-50 to-white p-8 md:flex-row md:p-10 dark:from-emerald-950/40 dark:via-zinc-900/40 dark:to-black">
					<div>
						<h2 className="text-2xl font-bold">{t("ctaTitle")}</h2>
						<p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
							{t("ctaDesc")}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-4">
						<WalletConnectButton />
						<Link
							href="/organizer/new"
							className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
						>
							{t("createEvent")}
						</Link>
						<Link
							href="/"
							className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
						>
							{t("backToHome")} <ArrowRight className="size-4" />
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
