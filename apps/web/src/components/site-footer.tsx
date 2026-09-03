import { useTranslations } from "next-intl";
import { ReduceMotionToggle } from "@/components/reduce-motion-toggle";

export function SiteFooter() {
	const t = useTranslations("SiteFooter");

	const LINKS = [
		{ href: "https://github.com/Astrea-Payouts/astrea", label: t("github") },
		{
			href: "https://github.com/Astrea-Payouts/astrea/blob/main/docs/build-plan.md",
			label: t("buildPlan"),
		},
		{
			href: "https://github.com/Astrea-Payouts/astrea/blob/main/docs/architecture.md",
			label: t("architecture"),
		},
		{
			href: "https://github.com/Astrea-Payouts/astrea/blob/main/CONTRIBUTING.md",
			label: t("contributing"),
		},
		{
			href: "https://github.com/Astrea-Payouts/astrea/blob/main/LICENSE",
			label: t("license"),
		},
	];

	return (
		<footer className="border-t">
			<div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
				<p>{t("copyright", { year: new Date().getFullYear() })}</p>
				<nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
					{LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="hover:text-foreground"
						>
							{link.label}
						</a>
					))}
				</nav>
				<ReduceMotionToggle variant="labelled" />
			</div>
		</footer>
	);
}
