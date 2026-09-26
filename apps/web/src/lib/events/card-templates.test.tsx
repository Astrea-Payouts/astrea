import { describe, expect, it } from "vitest";
import type { CardWinner, EventCardModel } from "./card-model";
import {
	DisplayEventCard,
	OpenEventCard,
	renderEventCard,
	WinnersEventCard,
} from "./card-templates";

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

	it("renders display projector card with judging subtitle during JUDGING state", () => {
		const tree = DisplayEventCard({
			model: { ...baseModel, status: "JUDGING" },
			canonicalUrl: "https://astrea.app/en/events/evt-test-1",
		});
		const json = JSON.stringify(tree);
		expect(json).toContain("Scan to follow judging");
		expect(json).not.toContain("Scan to view & register");
	});

	it("renders pending payout badge and pending text when a winner payout is pending", () => {
		const modelWithPending: EventCardModel = {
			...baseModel,
			status: "COMPLETED",
			templateType: "winners",
			winners: [
				{
					rank: 1,
					teamName: "Pending Team",
					members: ["@builder_1"],
					amount: "5000",
					asset: "USDC",
					txHash: null,
				},
			],
		};
		const tree = WinnersEventCard({ model: modelWithPending });
		const props = tree.props as { children: React.ReactNode[] };
		const header = props.children[0];
		const footer = props.children[3];
		expect(JSON.stringify(header)).toContain("COMPLETED • PAYOUTS PENDING");
		expect(JSON.stringify(footer)).toContain(
			"Payouts pending on-chain confirmation",
		);
		expect(JSON.stringify(footer)).not.toContain(
			"All payouts verified on Stellar",
		);
	});

	it("renders moreWinnersPaid when all omitted winners have verified payouts", () => {
		const winners = makeWinners(8); // 8 winners, top 6 visible, 2 omitted, all with txHash
		const model: EventCardModel = {
			...baseModel,
			status: "COMPLETED",
			templateType: "winners",
			winners,
		};
		const tree = WinnersEventCard({ model });
		const json = JSON.stringify(tree);
		expect(json).toContain("+2 more winners paid on-chain");
	});

	it("renders moreWinnersPending when an omitted winner has pending payout", () => {
		const winners = makeWinners(8);
		winners[7].txHash = null; // omitted winner (rank 8) has pending payout
		const model: EventCardModel = {
			...baseModel,
			status: "COMPLETED",
			templateType: "winners",
			winners,
		};
		const tree = WinnersEventCard({ model });
		const json = JSON.stringify(tree);
		expect(json).toContain("+2 more winners pending payout");
	});

	it("renders localized Spanish labels when labels prop is provided", () => {
		const tree = OpenEventCard({
			model: baseModel,
			labels: {
				registrationsOpen: "INSCRIPCIONES ABIERTAS",
				lockedPrizePool: "POZO DE PREMIOS BLOQUEADO ON-CHAIN",
			},
		});
		const json = JSON.stringify(tree);
		expect(json).toContain("INSCRIPCIONES ABIERTAS");
		expect(json).toContain("POZO DE PREMIOS BLOQUEADO ON-CHAIN");
	});
});
