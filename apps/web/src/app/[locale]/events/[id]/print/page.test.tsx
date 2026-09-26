// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import messagesEn from "../../../../../../messages/en.json";
import messagesEs from "../../../../../../messages/es.json";
import EventPrintPage from "./page";

vi.mock("next/navigation", () => ({
	notFound: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
	getTranslations: async (
		arg: string | { namespace?: string; locale?: string },
	) => {
		const locale = typeof arg === "object" && arg.locale ? arg.locale : "en";
		const msgs = locale === "es" ? messagesEs : messagesEn;
		const namespace = typeof arg === "string" ? arg : arg?.namespace;
		return createTranslator({
			locale,
			messages: msgs,
			namespace: namespace as never,
		});
	},
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

	afterEach(() => {
		cleanup();
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

	it("renders unavailable state when escrowEventId is missing", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-completed-no-escrow",
			status: "COMPLETED",
			name: "Completed Without Escrow",
			escrowEventId: null,
			organizerWallet: { address: "GDQP..." },
			prizes: [],
			judges: [],
			teams: [],
		} as never);

		const jsx = await EventPrintPage({
			params: Promise.resolve({ locale: "en", id: "evt-completed-no-escrow" }),
		});

		render(jsx);

		expect(notFound).not.toHaveBeenCalled();
		expect(screen.getByText("Receipt Unavailable")).toBeInTheDocument();
		expect(
			screen.getByText(
				"This event cannot issue an official payout receipt because its on-chain escrow funds could not be verified.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("← Back to event")).toBeInTheDocument();
	});

	it("renders unavailable state when readEscrowEvent fails", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-completed-escrow-err",
			status: "COMPLETED",
			name: "Completed Escrow Error",
			escrowEventId: "0102030405060708090a0b0c0d0e0f10",
			organizerWallet: { address: "GDQP..." },
			prizes: [],
			judges: [],
			teams: [],
		} as never);

		vi.mocked(readEscrowEvent).mockRejectedValue(new Error("RPC failure"));

		const jsx = await EventPrintPage({
			params: Promise.resolve({ locale: "en", id: "evt-completed-escrow-err" }),
		});

		render(jsx);

		expect(notFound).not.toHaveBeenCalled();
		expect(screen.getByText("Receipt Unavailable")).toBeInTheDocument();
	});

	it("renders COMPLETED / PAYOUT PENDING when a completed event has a pending payout", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-completed-pending",
			status: "COMPLETED",
			name: "Completed With Pending Payout",
			escrowEventId: "0102030405060708090a0b0c0d0e0f10",
			organizerWallet: {
				address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3IFHAY4B2P76",
			},
			judges: [],
			teams: [
				{
					id: "team-1",
					name: "Pending Team",
					members: [],
				},
			],
			prizes: [
				{
					id: "prz-1",
					rank: 1,
					amount: "5000",
					winnerTeamId: "team-1",
					releaseTxHash: null,
				},
			],
		} as never);

		vi.mocked(readEscrowEvent).mockResolvedValue({
			reward: BigInt("50000000000"),
			state: "Active",
		} as never);

		const jsx = await EventPrintPage({
			params: Promise.resolve({ locale: "en", id: "evt-completed-pending" }),
		});

		render(jsx);

		expect(screen.getByText("COMPLETED / PAYOUT PENDING")).toBeInTheDocument();
		expect(screen.queryByText("COMPLETED / PAID")).not.toBeInTheDocument();
		expect(screen.getByText("Pending")).toBeInTheDocument();
	});

	it("renders COMPLETED / PAYOUT PENDING when an event has an unawarded prize (missing winnerTeamId)", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-completed-unawarded",
			status: "COMPLETED",
			name: "Completed With Unawarded Prize",
			escrowEventId: "0102030405060708090a0b0c0d0e0f10",
			organizerWallet: {
				address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3IFHAY4B2P76",
			},
			judges: [],
			teams: [
				{
					id: "team-1",
					name: "Awarded Team",
					members: [],
				},
			],
			prizes: [
				{
					id: "prz-1",
					rank: 1,
					amount: "5000",
					winnerTeamId: "team-1",
					releaseTxHash: "0x1234567890abcdef1234567890abcdef",
				},
				{
					id: "prz-2",
					rank: 2,
					amount: "2500",
					winnerTeamId: null,
					releaseTxHash: null,
				},
			],
		} as never);

		vi.mocked(readEscrowEvent).mockResolvedValue({
			reward: BigInt("75000000000"),
			state: "Active",
		} as never);

		const jsx = await EventPrintPage({
			params: Promise.resolve({ locale: "en", id: "evt-completed-unawarded" }),
		});

		render(jsx);

		expect(screen.getByText("COMPLETED / PAYOUT PENDING")).toBeInTheDocument();
		expect(screen.queryByText("COMPLETED / PAID")).not.toBeInTheDocument();
	});

	it("renders the receipt with LOCKED PRIZE POOL and COMPLETED / PAID when verified", async () => {
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
		expect(screen.getByText("COMPLETED / PAID")).toBeInTheDocument();
		expect(screen.getByText("Locked Prize Pool")).toBeInTheDocument();
		expect(screen.queryByText("Total Distributed")).not.toBeInTheDocument();
		expect(screen.getAllByText("7500 USDC").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByLabelText("Event QR Code")).toBeInTheDocument();
	});

	it("renders localized receipt in Spanish when locale is 'es'", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-completed-es",
			status: "COMPLETED",
			name: "Hackatón Completado 2026",
			escrowEventId: "0102030405060708090a0b0c0d0e0f10",
			organizerWallet: {
				address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3IFHAY4B2P76",
			},
			judges: [],
			teams: [
				{
					id: "team-1",
					name: "Equipo Ganador",
					members: [],
				},
			],
			prizes: [
				{
					id: "prz-1",
					rank: 1,
					amount: "3000",
					winnerTeamId: "team-1",
					releaseTxHash:
						"f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2",
				},
			],
		} as never);

		vi.mocked(readEscrowEvent).mockResolvedValue({
			reward: BigInt("30000000000"),
			state: "Active",
		} as never);

		const jsx = await EventPrintPage({
			params: Promise.resolve({ locale: "es", id: "evt-completed-es" }),
		});

		render(jsx);

		expect(screen.getByText("Pozo de Premios Bloqueado")).toBeInTheDocument();
		expect(screen.getByText("COMPLETADO / PAGADO")).toBeInTheDocument();
		expect(screen.getByText("← Volver al evento")).toBeInTheDocument();
		expect(screen.getByText("Imprimir / Guardar PDF (A4)")).toBeInTheDocument();
		expect(
			screen.getByText("ESCROW INTELIGENTE DE STELLAR"),
		).toBeInTheDocument();
	});
});
