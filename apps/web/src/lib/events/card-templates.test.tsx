import { describe, expect, it } from "vitest";
import type { CardWinner, EventCardModel } from "./card-model";
import { DisplayEventCard, renderEventCard } from "./card-templates";

describe("card-templates", () => {
	const baseModel: EventCardModel = {
		id: "evt-test-1",
		name: "Stellar Meridian Hackathon",
		locale: "en",
		status: "LIVE",
		organizer: "GDQP2K…4B2P76",
		judges: ["cLamberti", "Dmong04"],
		prizePool: {
			amount: "10000",
			asset: "USDC",
		},
		judgingDeadlineAt: "2026-10-01T00:00:00.000Z",
		formattedDeadline: "Oct 1, 2026",
		registrationClosesAt: "2026-09-25T00:00:00.000Z",
		isRegistrationClosed: false,
		teamsRegistered: 8,
		winners: [],
		hasVerifiableMoney: true,
		templateType: "open",
	};

	const makeWinners = (count: number): CardWinner[] => {
		return Array.from({ length: count }, (_, i) => ({
			rank: i + 1,
			teamName: `Team Alpha ${i + 1}`,
			members: [`@builder_${i + 1}`],
			amount: `${(5000 / (i + 1)).toFixed(0)}`,
			asset: "USDC",
			txHash: `txhash00000000000000000000000000000000000000000000000000000000000${i + 1}`,
		}));
	};

	it("renders generic card for excluded states or no money", () => {
		const tree = renderEventCard({ ...baseModel, templateType: "generic" });
		expect(tree).toMatchSnapshot();
	});

	it("renders open card for LIVE event", () => {
		const tree = renderEventCard(baseModel);
		expect(tree).toMatchSnapshot();
	});

	it("renders open card for LIVE event with closed registrations", () => {
		const tree = renderEventCard({
			...baseModel,
			isRegistrationClosed: true,
		});
		expect(tree).toMatchSnapshot();
	});

	it("renders open card for JUDGING event", () => {
		const tree = renderEventCard({
			...baseModel,
			status: "JUDGING",
		});
		expect(tree).toMatchSnapshot();
	});

	it("renders winners template with 1 winner (hero)", () => {
		const model: EventCardModel = {
			...baseModel,
			status: "COMPLETED",
			templateType: "winners",
			winners: makeWinners(1),
		};
		const tree = renderEventCard(model);
		expect(tree).toMatchSnapshot();
	});

	it("renders winners template with 2 winners (podium of 2)", () => {
		const model: EventCardModel = {
			...baseModel,
			status: "COMPLETED",
			templateType: "winners",
			winners: makeWinners(2),
		};
		const tree = renderEventCard(model);
		expect(tree).toMatchSnapshot();
	});

	it("renders winners template with 3 winners (podium of 3)", () => {
		const model: EventCardModel = {
			...baseModel,
			status: "COMPLETED",
			templateType: "winners",
			winners: makeWinners(3),
		};
		const tree = renderEventCard(model);
		expect(tree).toMatchSnapshot();
	});

	it("renders winners template with 6 winners (top 3 + 3 more)", () => {
		const model: EventCardModel = {
			...baseModel,
			status: "COMPLETED",
			templateType: "winners",
			winners: makeWinners(6),
		};
		const tree = renderEventCard(model);
		expect(tree).toMatchSnapshot();
	});

	it("renders display projector card with QR code", () => {
		const tree = DisplayEventCard({
			model: baseModel,
			canonicalUrl: "https://astrea.app/en/events/evt-test-1",
		});
		expect(tree).toMatchSnapshot();
	});
});
