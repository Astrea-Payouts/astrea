import Image from "next/image";
import Link from "next/link";
import { WalletConnectButton } from "@/components/wallet-connect-button";

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

// Absolute + transparent so it floats over the homepage hero's dark
// LightPillar background instead of sitting on its own solid bar. This only
// works because the only page today IS that hero — once Phase 3 adds pages
// without one (dashboard, event pages), this needs a non-transparent variant
// for those, or the logo/button here will be invisible against a light page.
export function SiteHeader() {
	return (
		<header className="absolute inset-x-0 top-0 z-20">
			<div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5 md:px-12">
				<Link href="/" className="flex items-center">
					<Image
						src="/astrea-sided-logo-light.png"
						alt="Astrea"
						width={216}
						height={144}
						className="h-16 w-auto invert"
						priority
					/>
				</Link>
				<nav className="flex items-center gap-4">
					<Link
						href="https://github.com/Astrea-Payouts/astrea"
						className="text-white/70 hover:text-white"
						aria-label="Astrea on GitHub"
					>
						<GithubIcon />
					</Link>
					<WalletConnectButton className="bg-white text-black hover:bg-white/90" />
				</nav>
			</div>
		</header>
	);
}
