import { describe, expect, it, vi } from "vitest";
import {
	type PublicEventView,
	sanitizePublicEvent,
} from "@/lib/event-public-view";
import { buildEventJsonLd, generateMetadata } from "./page";

vi.mock("@/lib/event-public-view", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/event-public-view")>();
	return {
		...actual,
		getPublicEventById: vi.fn(async (id: string) => {
			if (id === "evt_found_1") {
				return {
					id: "evt_found_1",
					name: "Soroban DeFi Summit",
					description: "Annual conference and hackathon.",
					startsAt: new Date("2026-11-01T00:00:00.000Z"),
					endsAt: new Date("2026-11-05T00:00:00.000Z"),
					status: "LIVE",
					network: "mainnet",
					escrowContractId:
						"CDIWLY6ARVUGEJPUMWK5CZBEN4ENVAMY5NV2EGDF2EPKRGSVQTUAOIH3",
					organizerWalletAddress: "GPUBLICWALLET123",
					totalPrizeUsdc: 25000,
					prizes: [],
					judges: [],
				};
			}
			return null;
		}),
	};
});

describe("Event SEO and Public View (U03 & U10)", () => {
	const mockEventData: PublicEventView = {
		id: "evt_stellar_hack_101",
		name: "Stellar Global Buildathon 2026",
		description:
			"Build groundbreaking Soroban smart contracts with guaranteed prize escrow.",
		startsAt: new Date("2026-10-01T00:00:00.000Z"),
		endsAt: new Date("2026-10-15T23:59:59.000Z"),
		status: "LIVE",
		network: "testnet",
		escrowContractId:
			"CDIWLY6ARVUGEJPUMWK5CZBEN4ENVAMY5NV2EGDF2EPKRGSVQTUAOIH3",
		totalPrizeUsdc: 15000,
		prizes: [
			{
				id: "prz_1",
				rank: 1,
				amountUsdc: 10000,
				milestoneIndex: 0,
				status: "RELEASED",
				releaseTxHash:
					"6b041eb9bb62939316d9a04ad53cf5db3ce2bb9cf7bcfe21609101ad4043b27b",
				releasedAt: new Date("2026-10-16T12:00:00.000Z"),
				winnerAddress:
					"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			},
			{
				id: "prz_2",
				rank: 2,
				amountUsdc: 5000,
				milestoneIndex: 1,
				status: "PENDING",
			},
		],
		judges: [
			{
				id: "jdg_1",
				walletAddress:
					"GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3IFOKWSQDEAD",
				status: "ACTIVE",
			},
		],
		resolver: {
			name: "Astrea (default)",
			isDefault: true,
		},
		organizerWalletAddress:
			"GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
	};

	describe("buildEventJsonLd (schema.org/Event)", () => {
		it("generates a valid schema.org/Event payload", () => {
			const jsonLd = buildEventJsonLd(mockEventData, "en");

			expect(jsonLd["@context"]).toBe("https://schema.org");
			expect(jsonLd["@type"]).toBe("Event");
			expect(jsonLd.name).toBe("Stellar Global Buildathon 2026");
			expect(jsonLd.description).toContain("Soroban smart contracts");
			expect(jsonLd.startDate).toBe("2026-10-01T00:00:00.000Z");
			expect(jsonLd.endDate).toBe("2026-10-15T23:59:59.000Z");
			expect(jsonLd.eventStatus).toBe("https://schema.org/EventScheduled");
			expect(jsonLd.eventAttendanceMode).toBe(
				"https://schema.org/OnlineEventAttendanceMode",
			);

			// Location virtual check
			expect(jsonLd.location).toEqual({
				"@type": "VirtualLocation",
				url: "https://astrea.app/en/events/evt_stellar_hack_101",
			});

			// Organizer check
			expect(jsonLd.organizer).toEqual({
				"@type": "Organization",
				name: "Astrea",
				url: "https://astrea.app",
			});

			// Offers / Prize Pool check
			expect(jsonLd.offers).toHaveLength(2);
			expect(jsonLd.offers[0]).toEqual({
				"@type": "Offer",
				name: "Rank #1 Prize",
				price: 10000,
				priceCurrency: "USD",
				availability: "https://schema.org/InStock",
				url: "https://astrea.app/en/events/evt_stellar_hack_101",
			});
			expect(jsonLd.offers[1].price).toBe(5000);
		});

		it("maps event status to schema.org status correctly", () => {
			const cancelledEvent = { ...mockEventData, status: "CANCELLED" };
			expect(buildEventJsonLd(cancelledEvent, "en").eventStatus).toBe(
				"https://schema.org/EventCancelled",
			);

			const completedEvent = { ...mockEventData, status: "COMPLETED" };
			expect(buildEventJsonLd(completedEvent, "en").eventStatus).toBe(
				"https://schema.org/EventMovedOnline",
			);
		});
	});

	describe("sanitizePublicEvent security boundary", () => {
		it("strips private user/auth data and only exposes public fields", () => {
			const rawDbEvent = {
				id: "evt_123",
				name: "Hackathon",
				description: "Testing",
				startsAt: "2026-09-01T00:00:00Z",
				endsAt: "2026-09-10T00:00:00Z",
				status: "LIVE",
				network: "TESTNET",
				escrowContractId: "CCONTR123",
				organizerId: "usr_secret_id_never_leak",
				organizerEmail: "organizer@private.com",
				organizerWallet: {
					id: "wlt_priv_123",
					userId: "usr_secret_id_never_leak",
					address: "GPUBLICWALLET123",
				},
				prizes: [
					{
						id: "prz_1",
						rank: 1,
						amountUsdc: "100.0000000",
						milestoneIndex: 0,
						status: "PENDING",
					},
				],
				judges: [
					{
						id: "jdg_1",
						walletAddress: "GJUDGEWALLET123",
						status: "ACTIVE",
					},
				],
			};

			const publicView = sanitizePublicEvent(rawDbEvent);

			expect(publicView.id).toBe("evt_123");
			expect(publicView.name).toBe("Hackathon");
			expect(publicView.organizerWalletAddress).toBe("GPUBLICWALLET123");
			expect(publicView.totalPrizeUsdc).toBe(100);

			// Security assertions: private fields must NOT exist on public view
			const exposed = publicView as unknown as Record<string, unknown>;
			expect(exposed.organizerId).toBeUndefined();
			expect(exposed.organizerEmail).toBeUndefined();
			expect(exposed.organizer).toBeUndefined();
		});
	});

	describe("generateMetadata", () => {
		it("returns fallback metadata when event is not found", async () => {
			const metadata = await generateMetadata({
				params: Promise.resolve({ locale: "en", id: "non_existent_id" }),
			});

			expect(metadata.title).toBe("Event Not Found");
			expect(metadata.description).toContain("does not exist");
		});

		it("generates rich SEO metadata when event is found", async () => {
			const metadata = await generateMetadata({
				params: Promise.resolve({ locale: "en", id: "evt_found_1" }),
			});

			expect(metadata.title).toBe(
				"Soroban DeFi Summit - Verified Prize Escrow",
			);
			expect(metadata.description).toBe("Annual conference and hackathon.");
			expect(metadata.openGraph?.title).toBe(
				"Soroban DeFi Summit - Verified Prize Escrow | Astrea",
			);
			expect((metadata.twitter as { card?: string } | undefined)?.card).toBe(
				"summary_large_image",
			);
		});
	});
});
