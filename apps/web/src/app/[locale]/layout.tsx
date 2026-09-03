import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PwaRegister } from "@/components/pwa-register";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MotionPreferenceProvider } from "@/hooks/use-reduced-motion";
import { routing } from "@/i18n/routing";
import { WalletProvider } from "@/lib/wallet/provider";
import "../globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://astrea.app";

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "Metadata" });

	return {
		metadataBase: new URL(siteUrl),
		title: {
			default: t("title"),
			template: "%s | Astrea",
		},
		description: t("description"),
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
		alternates: {
			languages: Object.fromEntries(
				routing.locales.map((l) => [l, `${siteUrl}/${l}`]),
			),
		},
		openGraph: {
			type: "website",
			locale: locale === "es" ? "es_ES" : "en_US",
			url: `${siteUrl}/${locale}`,
			siteName: "Astrea",
			title: t("title"),
			description: t("description"),
			images: [
				{
					url: "/og-image.png",
					width: 1200,
					height: 630,
					alt: t("title"),
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title: t("title"),
			description: t("description"),
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
		manifest: "/manifest.webmanifest",
		appleWebApp: {
			capable: true,
			statusBarStyle: "black-translucent",
			title: "Astrea",
		},
		icons: {
			icon: "/favicon.ico",
			apple: "/icons/apple-touch-icon.png",
		},
	};
}

export const viewport: Viewport = {
	themeColor: "#05060d",
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
};

export default async function LocaleLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = await params;
	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	return (
		<html
			lang={locale}
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="relative min-h-full flex flex-col">
				<NextIntlClientProvider>
					<MotionPreferenceProvider>
						<WalletProvider>
							<SiteHeader />
							{children}
							<SiteFooter />
						</WalletProvider>
					</MotionPreferenceProvider>
				</NextIntlClientProvider>
				<PwaRegister />
			</body>
		</html>
	);
}
