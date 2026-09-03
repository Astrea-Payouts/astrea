"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ReduceMotionToggle } from "@/components/reduce-motion-toggle";
import { resolveHeaderVariant } from "@/components/resolve-header-variant";
import { StaggeredMenu } from "@/components/staggered-menu";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useScrolledPast } from "@/hooks/use-scrolled-past";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function GithubIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			className="size-5"
			aria-hidden="true"
		>
			<path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.26 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A10.98 10.98 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
		</svg>
	);
}

// Roughly a third of the header height, so the background arrives as soon as
// content starts sliding underneath rather than after a long transparent gap.
const OPAQUE_AFTER_PX = 32;

export interface SiteHeaderProps {
	variant?: "transparent" | "solid";
	className?: string;
}

export function SiteHeader({ variant, className }: SiteHeaderProps) {
	const t = useTranslations("SiteHeader");
	const pathname = usePathname();

	const resolvedVariant = resolveHeaderVariant(variant, pathname);
	const scrolled = useScrolledPast(OPAQUE_AFTER_PX);

	// The solid variant is opaque from the start; the transparent one earns its
	// background once the hero stops being what sits behind it.
	const opaque = resolvedVariant === "solid" || scrolled;

	return (
		<header
			className={cn(
				"z-40 transition-colors duration-300",
				// The transparent variant overlays the hero, so it is out of flow and
				// has to be fixed to survive scrolling. The solid variant stays sticky:
				// it is the first element in the flow, so top-0 pins it from the very
				// first pixel — visually identical to fixed, but it keeps reserving its
				// own height instead of letting the page slide underneath.
				resolvedVariant === "transparent"
					? "fixed inset-x-0 top-0"
					: "sticky top-0",
				// Chrome only from md up, where the header actually draws a bar.
				// Below that the row is hidden and StaggeredMenu draws its own UI, so
				// the element is 1px tall — painting it opaque put a dark strip with a
				// light border across the top of every phone screen once scrolled.
				//
				// The transparent border reserves the same 1px in both states, so
				// gaining it on scroll does not nudge the header contents down.
				opaque
					? "md:border-b md:border-white/10 md:bg-zinc-950/95 md:backdrop-blur-md"
					: "md:border-b md:border-transparent",
				className,
			)}
		>
			<div className="hidden items-center justify-between gap-4 px-6 py-4 md:flex md:px-12">
				<Link href="/" className="flex items-center">
					<Image
						src="/astrea-sided-logo-light-trimmed.png"
						alt="Astrea"
						width={1053}
						height={381}
						className="h-14 w-auto invert md:h-20"
						priority
					/>
				</Link>

				<nav className="flex items-center gap-6">
					<Link
						href="/participant"
						className="text-sm font-medium text-white/70 transition-colors hover:text-white"
					>
						{t("participantNav")}
					</Link>
					<Link
						href="/organizer"
						className="text-sm font-medium text-white/70 transition-colors hover:text-white"
					>
						{t("organizerNav")}
					</Link>
					<LanguageSwitcher />
					<ReduceMotionToggle />
					<a
						href="https://github.com/Astrea-Payouts/astrea"
						className="text-white/70 hover:text-white"
						aria-label={t("githubAriaLabel")}
					>
						<GithubIcon />
					</a>
					<WalletConnectButton className="bg-white text-black hover:bg-white/90" />
				</nav>
			</div>

			<StaggeredMenu
				className="md:hidden"
				isFixed
				position="right"
				items={[
					{ label: t("homeLabel"), ariaLabel: t("homeAriaLabel"), link: "/" },
					{
						label: t("participantNav"),
						ariaLabel: t("participantAriaLabel"),
						link: "/participant",
					},
					{
						label: t("organizerNav"),
						ariaLabel: t("organizerAriaLabel"),
						link: "/organizer",
					},
				]}
				socialItems={[
					{
						label: t("githubAriaLabel"),
						link: "https://github.com/Astrea-Payouts/astrea",
					},
				]}
				displaySocials
				displayItemNumbering={false}
				logoUrl="/astrea-logo-mark.png"
				colors={["#0a0a0a", "#000000"]}
				accentColor="#000000"
				menuButtonColor="#fff"
				openMenuButtonColor="#000"
				openAriaLabel={t("openMenu")}
				closeAriaLabel={t("closeMenu")}
				menuLabel={t("menuLabel")}
				closeLabel={t("closeLabel")}
				panelExtra={
					<>
						<LanguageSwitcher variant="light" />
						<ReduceMotionToggle
							variant="labelled"
							className="w-full text-black"
						/>
						<WalletConnectButton className="w-full justify-center bg-black text-white hover:bg-black/90" />
					</>
				}
			/>
		</header>
	);
}
