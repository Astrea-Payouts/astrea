import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WalletProvider } from "@/lib/wallet/provider";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://astrea.app";

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: {
		default: "Astrea — Escrow-Backed Prize Payouts on Stellar",
		template: "%s | Astrea",
	},
	description:
		"Escrow-backed prize payouts for hackathons, bounties, and community challenges — powered by Stellar smart escrows.",
	keywords: [
		"Stellar",
		"hackathons",
		"bounties",
		"escrow",
		"smart contracts",
		"prize payouts",
		"crypto bounties",
		"Trustless Work",
	],
	authors: [{ name: "Astrea" }],
	creator: "Astrea",
	publisher: "Astrea",
	openGraph: {
		type: "website",
		locale: "en_US",
		url: siteUrl,
		siteName: "Astrea",
		title: "Astrea — Escrow-Backed Prize Payouts on Stellar",
		description:
			"Escrow-backed prize payouts for hackathons, bounties, and community challenges — funds locked on-chain before the event starts.",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "Astrea — Escrow-Backed Prize Payouts on Stellar",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Astrea — Escrow-Backed Prize Payouts on Stellar",
		description:
			"Escrow-backed prize payouts for hackathons, bounties, and community challenges — funds locked on-chain before the event starts.",
		images: ["/og-image.png"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="relative min-h-full flex flex-col">
				<WalletProvider>
					<SiteHeader />
					{children}
					<SiteFooter />
				</WalletProvider>
			</body>
		</html>
	);
}
