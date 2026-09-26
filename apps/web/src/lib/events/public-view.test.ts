import { describe, expect, it } from "vitest";
import {
	PUBLIC_EVENT_SELECT,
	resolveDisputeResolver,
	sanitizePublicEventView,
} from "./public-view";

describe("PublicEventView — row-level field exposure & ADR-003 resolver (Issue #64 / U03)", () => {
	it("PUBLIC_EVENT_SELECT explicitly excludes private Wallet/User fields", () => {
		expect(PUBLIC_EVENT_SELECT.organizerWallet.select).toEqual({
			id: true,
			address: true,
		});
		expect("email" in PUBLIC_EVENT_SELECT.organizerWallet.select).toBe(false);
		expect("userId" in PUBLIC_EVENT_SELECT.organizerWallet.select).toBe(false);
		expect("organizer" in PUBLIC_EVENT_SELECT).toBe(false);
	});

	it("sanitizePublicEventView strips private fields from organizer and team wallets", () => {
		const rawWithPrivateLeak = {
			id: "evt-1",
			name: "Stellar Builder Cup",
			description: "Public hackathon",
			status: "LIVE" as const,
			escrowEventId: "a".repeat(32),
			organizerId: "private-user-uuid",
			organizerWalletId: "w-org",
			organizer: {
				id: "private-user-uuid",
				email: "secret-organizer@example.com",
			},
			organizerWallet: {
				id: "w-org",
				address: "GORGANIZERADDRESS1234567890",
				email: "secret-organizer@example.com",
				userId: "private-user-uuid",
				usdcTrustlineVerifiedAt: new Date(),
			},
			prizes: [
				{
					id: "p-1",
					rank: 1,
					amount: "1000",
					status: "RELEASED",
					winnerTeamId: "t-1",
					releaseTxHash: "0941dbcdd6402436",
				},
			],
			judges: [
				{
					id: "j-1",
					walletAddress: "GJUDGEADDRESS1234567890",
					displayName: "Core Judge",
					status: "ACTIVE",
				},
			],
			teams: [
				{
					id: "t-1",
					name: "Alpha Team",
					submissionUrl: "https://github.com/astrea/demo",
					members: [
						{
							walletId: "w-member-1",
							ordinal: 1,
							shareBasisPoints: 10000,
							wallet: {
								id: "w-member-1",
								address: "GMEMBERADDRESS1234567890",
								email: "private-member@example.com",
								userId: "private-member-user-id",
							},
						},
					],
				},
			],
		};

		const view = sanitizePublicEventView(rawWithPrivateLeak);

		expect(view.organizerWallet).toEqual({
			id: "w-org",
			address: "GORGANIZERADDRESS1234567890",
		});
		expect("email" in view.organizerWallet).toBe(false);
		expect("userId" in view.organizerWallet).toBe(false);
		expect("organizer" in view).toBe(false);
		expect("organizerId" in view).toBe(false);

		const memberWallet = view.teams[0].members[0].wallet;
		expect(memberWallet).toEqual({
			id: "w-member-1",
			address: "GMEMBERADDRESS1234567890",
		});
		expect("email" in memberWallet).toBe(false);
		expect("userId" in memberWallet).toBe(false);
	});

	it("resolveDisputeResolver returns 'Astrea (default)' when no custom resolver is named (ADR-003)", () => {
		expect(resolveDisputeResolver(null)).toEqual({
			isDefault: true,
			label: "Astrea (default)",
			address: null,
		});
		expect(resolveDisputeResolver("")).toEqual({
			isDefault: true,
			label: "Astrea (default)",
			address: null,
		});
		expect(resolveDisputeResolver("GCUSTOMRESOLVER123456789")).toEqual({
			isDefault: false,
			label: "GCUSTOMRESOLVER123456789",
			address: "GCUSTOMRESOLVER123456789",
		});
	});
});
