// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const EVENT_ID = "20000000-0000-0000-0000-000000000001";
const ORGANIZER = "GD6W5FDF4D47V7FGLP5G77KHYD77H57V5M2F5K4L5K4L5K4L5K4L5K4L";
const JUDGE = "GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L";
const TX_HASH =
	"0941dbcdd6402436d4df9cf19a77ad45e2c5603d6d5bb96b44a7065969da8a67";

const { mockDb, mockSession, mockReadEscrow } = vi.hoisted(() => ({
	mockDb: { event: { findUnique: vi.fn() } },
	mockSession: vi.fn(),
	mockReadEscrow: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("@/lib/escrow/read-event", () => ({ readEscrowEvent: mockReadEscrow }));
vi.mock("next/navigation", () => ({
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
}));
vi.mock("next-intl/server", () => ({
	getTranslations: async (arg: string | { namespace: string }) =>
		createTranslator({
			locale: "en",
			messages,
			namespace: (typeof arg === "string" ? arg : arg.namespace) as never,
		}),
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
vi.mock("@/components/wallet-connect-button", () => ({
	WalletConnectButton: () => <button type="button">connect-wallet</button>,
}));
vi.mock("./registration-form", () => ({
	RegistrationForm: () => <div data-testid="registration-form" />,
}));
vi.mock("./judging-toggle", () => ({
	JudgingToggle: () => <div data-testid="judging-toggle" />,
}));

const { default: EventPage, generateMetadata } = await import("./page");

const params = Promise.resolve({ locale: "en", id: EVENT_ID });

const completedEvent = {
	id: EVENT_ID,
	name: "Hackathon Stellar 2026",
	description: "Escrow-backed public event",
	status: "COMPLETED" as const,
	organizerWalletId: "w-org",
	organizerWallet: { id: "w-org", address: ORGANIZER },
	escrowEventId: "escrow-01",
	judges: [{ id: "j-1", displayName: "Judge Alpha", walletAddress: JUDGE }],
	teams: [
		{
			id: "team-a",
			name: "Team Solvers",
			members: [
				{
					walletId: "w-mem",
					ordinal: 1,
					wallet: { id: "w-mem", address: "GAA..." },
				},
			],
		},
	],
	prizes: [
		{
			id: "prize-1",
			rank: 1,
			amount: { toString: () => "500" },
			winnerTeamId: "team-a",
			releaseTxHash: TX_HASH,
		},
		{
			id: "prize-2",
			rank: 2,
			amount: { toString: () => "250" },
			winnerTeamId: null,
			releaseTxHash: null,
		},
	],
};

async function renderPage() {
	const ui = await EventPage({ params });
	return renderWithIntl(ui);
}

describe("EventPage - Payout TxHashLink (Issue #211)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDb.event.findUnique.mockResolvedValue(completedEvent);
		mockSession.mockResolvedValue(null);
		mockReadEscrow.mockResolvedValue(null);
	});

	afterEach(() => {
		cleanup();
	});

	it("renders TxHashLink for prizes that have releaseTxHash on a COMPLETED event", async () => {
		await renderPage();

		expect(screen.getByText(/Paid on-chain/i)).toBeInTheDocument();
		const link = screen.getByRole("link", { name: /0941dbcd/i });
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute("href", expect.stringContaining(TX_HASH));
	});

	it("does not render TxHashLink for prizes without releaseTxHash", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			...completedEvent,
			prizes: [
				{
					id: "prize-2",
					rank: 2,
					amount: { toString: () => "250" },
					winnerTeamId: null,
					releaseTxHash: null,
				},
			],
		});

		await renderPage();

		expect(screen.queryByText(/Paid on-chain/i)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /0941/i }),
		).not.toBeInTheDocument();
	});
});

describe("EventPage - generateMetadata", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("titles the page with the event name", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			name: "Hackathon Stellar 2026",
			description: "Great event",
		});

		const meta = await generateMetadata({ params });
		expect(meta).toEqual({
			title: "Hackathon Stellar 2026",
			description: "Great event",
		});
	});

	it("returns empty object if event not found", async () => {
		mockDb.event.findUnique.mockResolvedValue(null);

		const meta = await generateMetadata({ params });
		expect(meta).toEqual({});
	});
});
