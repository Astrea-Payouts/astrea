import Link from "next/link";

const LINKS = [
	{ href: "https://github.com/Astrea-Payouts/astrea", label: "GitHub" },
	{
		href: "https://github.com/Astrea-Payouts/astrea/blob/main/docs/build-plan.md",
		label: "Build plan",
	},
	{
		href: "https://github.com/Astrea-Payouts/astrea/blob/main/docs/architecture.md",
		label: "Architecture",
	},
	{
		href: "https://github.com/Astrea-Payouts/astrea/blob/main/CONTRIBUTING.md",
		label: "Contributing",
	},
	{
		href: "https://github.com/Astrea-Payouts/astrea/blob/main/LICENSE",
		label: "MIT License",
	},
];

export function SiteFooter() {
	return (
		<footer className="border-t">
			<div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
				<p>
					© {new Date().getFullYear()} Astrea. Built in the open on Stellar.
				</p>
				<nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
					{LINKS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="hover:text-foreground"
						>
							{link.label}
						</Link>
					))}
				</nav>
			</div>
		</footer>
	);
}
