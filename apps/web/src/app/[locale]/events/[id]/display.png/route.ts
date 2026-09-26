import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import { buildEventCardModel } from "@/lib/events/card-model";
import {
	DisplayEventCard,
	getCardLabels,
	loadCardFont,
} from "@/lib/events/card-templates";
import { getSiteUrl } from "@/lib/site-url";

type Params = Promise<{ locale: string; id: string }>;

export async function GET(
	_request: Request,
	{ params }: { params: Params },
): Promise<Response> {
	const { id, locale } = await params;

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

	// Decision 7 & Acceptance criteria: 404 unless LIVE or JUDGING
	if (!event || (event.status !== "LIVE" && event.status !== "JUDGING")) {
		return new Response("Not Found", { status: 404 });
	}

	let escrow: Awaited<ReturnType<typeof readEscrowEvent>> | null = null;
	if (event.escrowEventId) {
		try {
			escrow = await readEscrowEvent(event.escrowEventId);
		} catch {
			escrow = null;
		}
	}

	const [fontData, labels] = await Promise.all([
		loadCardFont(),
		getCardLabels(locale),
	]);
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

	const model = buildEventCardModel({
		event,
		escrow,
		locale,
		assetSymbol: env.USDC_SYMBOL ?? "USDC",
	});

	const canonicalUrl = `${getSiteUrl()}/${locale}/events/${id}`;

	return new ImageResponse(DisplayEventCard({ model, canonicalUrl, labels }), {
		width: 1920,
		height: 1080,
		fonts,
		headers: {
			"cache-control": "no-store",
		},
	});
}
