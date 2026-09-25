import { describe, expect, it } from "vitest";
import {
	type BuildCardModelInput,
	buildEventCardModel,
	formatMemberHandle,
	truncateText,
} from "./card-model";

describe("card-model", () => {
	const baseInput: BuildCardModelInput = {
		event: {
			id: "evt-123",
			name: "Stellar Meridian Hackathon 2026",
			status: "LIVE",
			organizerWallet: {
				address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3IFHAY4B2P76",
			},
			judges: [
				{
					displayName: "cLamberti",
					walletAddress:
						"GBZXN7PIRZGNMHGA72ODBTDH2R4U7J5J5L6L7YXZUGBK6E6XZA6M47AA",
				},
			],
			teams: [
				{
					id: "team-1",
					name: "Alpha Builders",
					members: [
						{
							wallet: {
								address:
									"GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G6EB4T7KZBNPW5VW6W3X",
								linkedAccounts: [
									{ provider: "github", username: "Rodrigoue9" },
								],
							},
						},
					],
				},
			],
			prizes: [
				{
					id: "prz-1",
					rank: 1,
					amount: "5000",
					winnerTeamId: "team-1",
					releaseTxHash:
						"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
				},
			],
			judgingDeadlineAt: new Date("2026-10-01T00:00:00Z"),
			registrationClosesAt: new Date("2026-09-25T00:00:00Z"),
		},
		escrow: {
			reward: BigInt("100000000000"), // 10,000 USDC in 7 decimals
			state: "Active",
		},
		locale: "en",
		assetSymbol: "USDC",
	};

	it("builds an 'open' template for LIVE state with verifiable money", () => {
		const model = buildEventCardModel({
			...baseInput,
			now: new Date("2026-09-18T12:00:00Z"),
		});

		expect(model.templateType).toBe("open");
		expect(model.hasVerifiableMoney).toBe(true);
		expect(model.prizePool.amount).toBe("10000");
		expect(model.prizePool.asset).toBe("USDC");
		expect(model.teamsRegistered).toBe(1);
		expect(model.judges).toContain("cLamberti");
		expect(model.organizer).toBe("GDQP2K…4B2P76");
		expect(model.formattedDeadline).toBe("Oct 1, 2026");
		expect(model.isRegistrationClosed).toBe(false);
	});

	it("detects when registrations are closed", () => {
		const model = buildEventCardModel({
			...baseInput,
			now: new Date("2026-09-26T00:00:00Z"), // Past registrationClosesAt (2026-09-25)
		});

		expect(model.isRegistrationClosed).toBe(true);
	});

	it("builds an 'open' template for JUDGING state", () => {
		const model = buildEventCardModel({
			...baseInput,
			event: { ...baseInput.event, status: "JUDGING" },
		});

		expect(model.templateType).toBe("open");
		expect(model.status).toBe("JUDGING");
	});

	it("builds a 'winners' template for COMPLETED state with winners", () => {
		const model = buildEventCardModel({
			...baseInput,
			event: { ...baseInput.event, status: "COMPLETED" },
		});

		expect(model.templateType).toBe("winners");
		expect(model.winners).toHaveLength(1);
		expect(model.winners[0].teamName).toBe("Alpha Builders");
		expect(model.winners[0].members).toEqual(["@Rodrigoue9"]);
		expect(model.winners[0].amount).toBe("5000");
		expect(model.winners[0].txHash).toBe(
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
		);
	});

	it("falls back to 'generic' for excluded states (DRAFT, CREATED, DISPUTED, CANCELLED)", () => {
		for (const status of [
			"DRAFT",
			"CREATED",
			"DISPUTED",
			"CANCELLED",
		] as const) {
			const model = buildEventCardModel({
				...baseInput,
				event: { ...baseInput.event, status },
			});
			expect(model.templateType).toBe("generic");
		}
	});

	it("falls back to 'generic' if escrow has no verifiable money", () => {
		const modelNoEscrow = buildEventCardModel({
			...baseInput,
			escrow: null,
		});
		expect(modelNoEscrow.templateType).toBe("generic");
		expect(modelNoEscrow.hasVerifiableMoney).toBe(false);

		const modelZeroReward = buildEventCardModel({
			...baseInput,
			escrow: { reward: BigInt(0), state: "Active" },
		});
		expect(modelZeroReward.templateType).toBe("generic");
		expect(modelZeroReward.hasVerifiableMoney).toBe(false);
	});

	it("formats member handles with @github when available, otherwise short address", () => {
		const handleWithGithub = formatMemberHandle({
			address: "GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G6EB4T7KZBNPW5VW6W3X",
			linkedAccounts: [{ provider: "github", username: "octocat" }],
		});
		expect(handleWithGithub).toBe("@octocat");

		const handleWithoutGithub = formatMemberHandle({
			address: "GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G6EB4T7KZBNPW5VW6W3X",
			linkedAccounts: [],
		});
		expect(handleWithoutGithub).toBe("GA2C5R…VW6W3X");
	});

	it("truncates long strings with ellipsis", () => {
		const text =
			"A very long event title that definitely exceeds thirty characters";
		const truncated = truncateText(text, 30);
		expect(truncated.length).toBeLessThanOrEqual(30);
		expect(truncated.endsWith("…")).toBe(true);
	});
});
