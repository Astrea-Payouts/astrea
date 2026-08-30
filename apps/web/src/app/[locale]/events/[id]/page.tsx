import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PublicEventView } from "@/components/event/public-event-view";
import {
	getPublicEventById,
	toExplorerNetwork,
} from "@/lib/queries/public-event";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
	const { locale, id } = await params;
	const event = await getPublicEventById(id);
	if (!event) {
		return {};
	}

	const t = await getTranslations({ locale, namespace: "PublicEventPage" });

	return {
		title: event.name,
		description:
			event.description ??
			t("metadataDescription", {
				amount: event.totalPrizeUsdc,
			}),
		openGraph: {
			title: event.name,
			description:
				event.description ??
				t("metadataDescription", { amount: event.totalPrizeUsdc }),
		},
	};
}

export default async function PublicEventPage({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { id } = await params;
	const event = await getPublicEventById(id);

	if (!event) {
		notFound();
	}

	// Server-side sanity check — explorer network mapping stays typed.
	toExplorerNetwork(event.network);

	return <PublicEventView event={event} />;
}
