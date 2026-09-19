// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import EventPrintPage from "./page";

vi.mock("next/navigation", () => ({
	notFound: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		event: {
			findUnique: vi.fn(),
		},
	},
}));

vi.mock("@/lib/escrow/read-event", () => ({
	readEscrowEvent: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
	Link: ({
		href,
		children,
		...rest
	}: React.ComponentProps<"a"> & { href: string }) => (
		<a href={href} {...rest}>
			{children}
		</a>
	),
}));

describe("EventPrintPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls notFound() if the event does not exist", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue(null);

		await EventPrintPage({
			params: Promise.resolve({ locale: "en", id: "non-existent" }),
		});

		expect(notFound).toHaveBeenCalledTimes(1);
	});

	it("calls notFound() if the event is not in COMPLETED state", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-live",
			status: "LIVE",
			name: "Live Event",
			organizerWallet: { address: "GDO..." },
			prizes: [],
			judges: [],
			teams: [],
		} as never);

		await EventPrintPage({
			params: Promise.resolve({ locale: "en", id: "evt-live" }),
		});

		expect(notFound).toHaveBeenCalledTimes(1);
	});

	it("renders the receipt when the event is COMPLETED", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-completed",
			status: "COMPLETED",
			name: "Completed Hackathon 2026",
			escrowEventId: "0102030405060708090a0b0c0d0e0f10",
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
					name: "Winning Builders",
					members: [
						{
							wallet: {
								address:
									"GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G6EB4T7KZBNPW5VW6W3X",
								linkedAccounts: [{ provider: "github", username: "champion" }],
							},
						},
					],
				},
			],
			prizes: [
				{
					id: "prz-1",
					rank: 1,
					amount: "7500",
					winnerTeamId: "team-1",
					releaseTxHash:
						"f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2",
				},
			],
		} as never);

		vi.mocked(readEscrowEvent).mockResolvedValue({
			reward: BigInt("75000000000"),
			state: "Active",
		} as never);

		const jsx = await EventPrintPage({
			params: Promise.resolve({ locale: "en", id: "evt-completed" }),
		});

		render(jsx);

		expect(notFound).not.toHaveBeenCalled();
		expect(screen.getByText("Completed Hackathon 2026")).toBeInTheDocument();
		expect(screen.getByText("Winning Builders")).toBeInTheDocument();
		expect(screen.getByText("@champion")).toBeInTheDocument();
		expect(screen.getAllByText("7500 USDC").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByLabelText("Event QR Code")).toBeInTheDocument();
	});
});
