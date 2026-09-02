import {
	ArrowRight,
	CheckCircle2,
	ShieldCheck,
	Trophy,
	Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Link } from "@/i18n/navigation";

export default function ParticipantPage() {
	const t = useTranslations("ParticipantPage");

	return (
		<main className="min-h-screen bg-black text-white py-16 px-6 md:px-12">
			<div className="mx-auto max-w-4xl">
				<div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
					<Trophy className="size-3.5" />
					<span>{t("badge")}</span>
				</div>

				<h1 className="mt-5 font-serif text-4xl font-bold tracking-tight md:text-5xl">
					{t("title")}
				</h1>
				<p className="mt-4 max-w-2xl text-lg text-zinc-400">{t("tagline")}</p>

				<div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
					<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur">
						<div className="rounded-lg bg-blue-500/10 p-2.5 w-fit text-blue-400">
							<ShieldCheck className="size-5" />
						</div>
						<h3 className="mt-4 text-lg font-bold">{t("card1Title")}</h3>
						<p className="mt-2 text-sm text-zinc-400">{t("card1Desc")}</p>
					</div>

					<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur">
						<div className="rounded-lg bg-emerald-500/10 p-2.5 w-fit text-emerald-400">
							<Zap className="size-5" />
						</div>
						<h3 className="mt-4 text-lg font-bold">{t("card2Title")}</h3>
						<p className="mt-2 text-sm text-zinc-400">{t("card2Desc")}</p>
					</div>

					<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur">
						<div className="rounded-lg bg-indigo-500/10 p-2.5 w-fit text-indigo-400">
							<CheckCircle2 className="size-5" />
						</div>
						<h3 className="mt-4 text-lg font-bold">{t("card3Title")}</h3>
						<p className="mt-2 text-sm text-zinc-400">{t("card3Desc")}</p>
					</div>
				</div>

				<div className="mt-12 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/40 via-zinc-900/40 to-black p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
					<div>
						<h2 className="text-2xl font-bold">{t("ctaTitle")}</h2>
						<p className="mt-2 text-sm text-zinc-400 max-w-md">
							{t("ctaDesc")}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-4">
						<WalletConnectButton className="bg-white text-black hover:bg-white/90" />
						<Link
							href="/"
							className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white"
						>
							{t("backToHome")} <ArrowRight className="size-4" />
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
