import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import { buildEventCardModel } from "@/lib/events/card-model";
import { DisplayEventCard, loadCardFont } from "@/lib/events/card-templates";

type Params = Promise<{ locale: string; id: string }>;

export async function GET(
	request: Request,
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

	const model = buildEventCardModel({
		event,
		escrow,
		locale,
		assetSymbol: env.USDC_SYMBOL ?? "USDC",
	});

	const requestUrl = new URL(request.url);
	const canonicalUrl = `${requestUrl.origin}/${locale}/events/${id}`;

	return new ImageResponse(DisplayEventCard({ model, canonicalUrl }), {
		width: 1920,
		height: 1080,
		fonts,
	});
}
