"use client";

import { useTranslations } from "next-intl";
import type { PublicJudge } from "@/lib/queries/public-event";

export interface JudgesPanelProps {
	judges: PublicJudge[];
}

export function JudgesPanel({ judges }: JudgesPanelProps) {
	const t = useTranslations("PublicEventPage");

	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold">{t("judgesHeading")}</h2>
			{judges.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t("noJudges")}</p>
			) : (
				<ul className="space-y-2">
					{judges.map((judge) => (
						<li
							key={judge.walletAddress}
							className="rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-2"
						>
							<p className="font-medium">{judge.displayName}</p>
							<p className="font-mono text-xs text-muted-foreground">
								{judge.walletAddress}
							</p>
						</li>
					))}
				</ul>
			)}
			<p className="text-sm text-muted-foreground">{t("defaultResolver")}</p>
		</section>
	);
}
