import Image from "next/image";
import { useTranslations } from "next-intl";
import { ReduceMotionToggle } from "@/components/reduce-motion-toggle";

const REPO = "https://github.com/Astrea-Payouts/astrea";

export function SiteFooter() {
	const t = useTranslations("SiteFooter");

	const RESOURCES = [
		{ href: REPO, label: t("github") },
		{ href: `${REPO}/blob/main/docs/build-plan.md`, label: t("buildPlan") },
		{
			href: `${REPO}/blob/main/docs/architecture.md`,
			label: t("architecture"),
		},
	];

	const COMMUNITY = [
		{ href: `${REPO}/blob/main/CONTRIBUTING.md`, label: t("contributing") },
		{ href: `${REPO}/blob/main/LICENSE`, label: t("license") },
		{ href: `https://grantfox.xyz`, label: t("grantfox") },
	];

	const COLUMNS = [
		{ heading: t("resources"), links: RESOURCES },
		{ heading: t("community"), links: COMMUNITY },
	];

	return (
		<footer className="w-full border-t text-muted-foreground bg-gray-100 text-gray-900 dark:text-white dark:bg-gray-950">
			<div className="mx-auto max-w-5xl px-6 pt-10 md:px-8">
				<div className="flex w-full flex-col justify-between gap-10 border-b border-border pb-8 md:flex-row">
					{/* Brand & description */}
					<div className="md:max-w-96">
						<Image
							src="/astrea-sided-logo-light-trimmed.png"
							alt="Astrea"
							width={1053}
							height={381}
							className="h-10 w-auto md:h-12 dark:invert"
						/>
						<p className="mt-6 text-sm">{t("tagline")}</p>
					</div>

					{/* Link columns & Preferences */}
					<div className="flex flex-1 flex-wrap items-start gap-x-20 gap-y-10 md:justify-end">
						{COLUMNS.map((column) => (
							<div key={column.heading}>
								<h2 className="mb-5 font-semibold text-foreground text-gray-900 dark:text-white">
									{column.heading}
								</h2>
								<ul className="space-y-2 text-sm">
									{column.links.map((link) => (
										<li key={link.href}>
											<a
												href={link.href}
												className="transition-colors hover:text-foreground text-gray-900 hover:text-sky-400 dark:text-white dark:hover:text-sky-300"
											>
												{link.label}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}

						<div>
							<h2 className="mb-5 font-semibold text-foreground text-gray-900 dark:text-white">
								{t("preferences")}
							</h2>
							<ReduceMotionToggle variant="labelled" />
						</div>
					</div>
				</div>

				<p className="pb-5 pt-4 text-center text-xs md:text-sm">
					{t("copyright", { year: new Date().getFullYear() })}
				</p>
			</div>
		</footer>
	);
}
