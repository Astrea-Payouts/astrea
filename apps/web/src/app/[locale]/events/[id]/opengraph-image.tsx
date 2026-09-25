import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import { buildEventCardModel } from "@/lib/events/card-model";
import {
	GenericCard,
	loadCardFont,
	renderEventCard,
} from "@/lib/events/card-templates";

export const alt = "Astrea Event Card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ locale: string; id: string }>;

/**
 * Generates the 1200x630 Open Graph PNG image for an event page.
 */
export default async function Image({ params }: { params: Params }) {
	const { id, locale } = await params;
	const fontData = await loadCardFont();
	const fonts = fontData
		? [
				{
					name: "Inter",
					data: fontData,
					style: "normal" as const,
					weight: 400 as const,
				},
			]
		: [];

	const event = await db.event.findUnique({
		where: { id },
		include: {
			organizerWallet: { select: { address: true } },
			prizes: { orderBy: { rank: "asc" } },
			judges: { where: { status: "ACTIVE" } },
			teams: {
				orderBy: { createdAt: "asc" },
				include: {
					members: {
						orderBy: { ordinal: "asc" },
						include: {
							wallet: {
								select: {
									address: true,
									linkedAccounts: {
										where: { provider: "github" },
										select: { provider: true, username: true },
									},
								},
							},
						},
					},
				},
			},
		},
	});

	if (!event) {
		return new ImageResponse(<GenericCard />, {
			...size,
			fonts,
		});
	}

	let escrow: Awaited<ReturnType<typeof readEscrowEvent>> | null = null;
	if (event.escrowEventId) {
		try {
			escrow = await readEscrowEvent(event.escrowEventId);
		} catch {
			escrow = null;
		}
	}

	const model = buildEventCardModel({
		event,
		escrow,
		locale,
		assetSymbol: env.USDC_SYMBOL ?? "USDC",
	});

	return new ImageResponse(renderEventCard(model), {
		...size,
		fonts,
	});
}
