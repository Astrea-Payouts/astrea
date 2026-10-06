import { describe, expect, it } from "vitest";
import { type CardModel, renderSvgCard } from "./render";

describe("renderSvgCard", () => {
	const publicModel: CardModel = {
		login: "alice",
		isPublic: true,
		eventsParticipated: 4,
		prizesWon: 2,
		totalPaidAmount: "1,250",
		totalPaidAsset: "USDC",
		lastEvents: ['DeFi <Summer> & "Prize"', "Stellar Meridian"],
	};

	it("renders a public card with correctly escaped XML/SVG entities", () => {
		const svg = renderSvgCard(publicModel, "dark");
		expect(svg).toContain("@alice");
		expect(svg).toContain("4 events");
		expect(svg).toContain("2 wins");
		expect(svg).toContain("1,250 USDC");
		// Verify special character escaping
		expect(svg).toContain("DeFi &lt;Summer&gt; &amp; &quot;Prize&quot;");
		expect(svg).not.toContain("<Summer>");
	});

	it("renders the neutral card when profile is not public", () => {
		const privateModel: CardModel = {
			...publicModel,
			isPublic: false,
		};
		const svg = renderSvgCard(privateModel, "dark");
		expect(svg).toContain("@alice");
		expect(svg).toContain("Profile not public");
		expect(svg).not.toContain("1,250 USDC");
	});

	it("renders properly with light theme", () => {
		const svg = renderSvgCard(publicModel, "light");
		expect(svg).toContain('fill="#ffffff"');
		expect(svg).toContain("@alice");
	});

	it("handles empty lastEvents cleanly by displaying 'None'", () => {
		const emptyEventsModel: CardModel = {
			...publicModel,
			lastEvents: [],
		};
		const svg = renderSvgCard(emptyEventsModel, "dark");
		expect(svg).toContain("Recent: None");
	});

	it("slices lastEvents to at most 3 items and truncates long event names", () => {
		const longEventsModel: CardModel = {
			...publicModel,
			lastEvents: [
				"Super Incredibly Long Hackathon Name That Exceeds Normal Card Width Boundaries",
				"Event 2",
				"Event 3",
				"Event 4 (Should Be Excluded)",
			],
		};
		const svg = renderSvgCard(longEventsModel, "dark");
		expect(svg).not.toContain("Event 4 (Should Be Excluded)");
		expect(svg).toContain("…");
	});

	it("matches the expected svg snapshot structure", () => {
		const svg = renderSvgCard(publicModel, "dark");
		expect(svg).toMatchSnapshot();
	});
});
