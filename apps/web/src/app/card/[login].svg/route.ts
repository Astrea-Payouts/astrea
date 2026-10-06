import { type CardTheme, renderSvgCard } from "@/lib/card/render";
import { db } from "@/lib/db";

// Note: Organizer cards (same route family later, different data) - out of scope for U19.

type RouteContext = {
	params: Promise<{ login?: string }>;
};

function normalizeLogin(raw: string): string {
	try {
		return decodeURIComponent(raw).trim().replace(/^@/, "");
	} catch {
		return raw.trim().replace(/^@/, "");
	}
}

export async function GET(
	request: Request,
	context: RouteContext,
): Promise<Response> {
	const contextParams = (await context.params) as
		| { login?: string }
		| undefined;
	let rawLogin = contextParams?.login;
	if (!rawLogin) {
		const url = new URL(request.url);
		const match = url.pathname.match(/\/card\/([^/?#]+)/);
		if (match) {
			rawLogin = match[1];
		}
	}

	const cleanLogin = normalizeLogin(
		rawLogin ? rawLogin.replace(/\.svg$/, "") : "",
	);

	const url = new URL(request.url);
	const themeParam = url.searchParams.get("theme");
	const theme: CardTheme = themeParam === "light" ? "light" : "dark";

	const headers = {
		"Content-Type": "image/svg+xml; charset=utf-8",
		"Cache-Control": "public, max-age=300",
	};

	if (!cleanLogin) {
		const neutralSvg = renderSvgCard(
			{
				login: "unknown",
				isPublic: false,
				eventsParticipated: 0,
				prizesWon: 0,
				totalPaidAmount: "0",
				totalPaidAsset: "USDC",
				lastEvents: [],
			},
			theme,
		);
		return new Response(neutralSvg, { status: 200, headers });
	}

	try {
		const linkedAccount = await db.linkedAccount.findFirst({
			where: {
				provider: "GITHUB",
				username: { equals: cleanLogin, mode: "insensitive" },
			},
			include: {
				wallet: {
					include: {
						teamMemberships: {
							include: {
								team: {
									include: {
										event: {
											select: {
												id: true,
												name: true,
												network: true,
												status: true,
											},
										},
										wonPrizes: {
											include: {
												payouts: true,
											},
										},
									},
								},
								payouts: true,
							},
						},
					},
				},
			},
		});

		// A neutral card when the login is unknown or the profile is not public — never an error page
		if (!linkedAccount?.wallet.profilePublic) {
			const neutralSvg = renderSvgCard(
				{
					login: cleanLogin,
					isPublic: false,
					eventsParticipated: 0,
					prizesWon: 0,
					totalPaidAmount: "0",
					totalPaidAsset: "USDC",
					lastEvents: [],
				},
				theme,
			);
			return new Response(neutralSvg, { status: 200, headers });
		}

		const wallet = linkedAccount.wallet;
		const memberships = wallet.teamMemberships;

		// 1. Events participated (unique events count)
		const eventMap = new Map<string, string>();
		for (const m of memberships) {
			if (m.team?.event) {
				eventMap.set(m.team.event.id, m.team.event.name);
			}
		}
		const eventsParticipated = eventMap.size;

		// 2. Prizes won (count)
		let prizesWon = 0;
		for (const m of memberships) {
			if (m.team?.wonPrizes) {
				prizesWon += m.team.wonPrizes.length;
			}
		}

		// 3. Total paid amount (sum of payouts or prizes)
		let totalPaid = 0;
		for (const m of memberships) {
			if (m.payouts && m.payouts.length > 0) {
				for (const p of m.payouts) {
					totalPaid += Number(p.amount ?? 0);
				}
			} else if (m.team?.wonPrizes) {
				for (const pz of m.team.wonPrizes) {
					totalPaid += Number(pz.amount ?? 0);
				}
			}
		}

		// 4. Last three events by name
		const lastEvents = Array.from(eventMap.values()).slice(0, 3);

		const svg = renderSvgCard(
			{
				login: linkedAccount.username,
				isPublic: true,
				eventsParticipated,
				prizesWon,
				totalPaidAmount: totalPaid.toLocaleString("en-US"),
				totalPaidAsset: "USDC",
				lastEvents,
			},
			theme,
		);

		return new Response(svg, { status: 200, headers });
	} catch {
		// Resilience: Never serve an error page
		const neutralSvg = renderSvgCard(
			{
				login: cleanLogin,
				isPublic: false,
				eventsParticipated: 0,
				prizesWon: 0,
				totalPaidAmount: "0",
				totalPaidAsset: "USDC",
				lastEvents: [],
			},
			theme,
		);
		return new Response(neutralSvg, { status: 200, headers });
	}
}
