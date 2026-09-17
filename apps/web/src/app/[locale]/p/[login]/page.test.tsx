// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const { mockDb, mockNotFound } = vi.hoisted(() => ({
	mockDb: {
		linkedAccount: { findFirst: vi.fn() },
	},
	mockNotFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/navigation", () => ({ notFound: mockNotFound }));
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
	}: {
		href: string;
		children: React.ReactNode;
	}) => (
		<a href={href} {...rest}>
			{children}
		</a>
	),
}));
vi.mock("@/components/tx-hash-link", () => ({
	TxHashLink: ({ hash }: { hash: string }) => (
		<span data-testid="tx-hash-link">{hash}</span>
	),
}));

const { default: PublicProfilePage, generateMetadata } = await import("./page");

describe("PublicProfilePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("triggers notFound when no account is found for login", async () => {
		mockDb.linkedAccount.findFirst.mockResolvedValue(null);

		await expect(
			PublicProfilePage({
				params: Promise.resolve({ locale: "en", login: "unknownuser" }),
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");

		expect(mockNotFound).toHaveBeenCalled();
	});

	it("triggers notFound when profilePublic is false", async () => {
		mockDb.linkedAccount.findFirst.mockResolvedValue({
			id: "la-1",
			username: "privateDev",
			provider: "GITHUB",
			wallet: {
				id: "w-1",
				address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
				profilePublic: false,
				teamMemberships: [],
			},
		});

		await expect(
			PublicProfilePage({
				params: Promise.resolve({ locale: "en", login: "privateDev" }),
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");

		expect(mockNotFound).toHaveBeenCalled();
	});

	it("renders profile with wallet, submissions, and payout links when profilePublic is true", async () => {
		mockDb.linkedAccount.findFirst.mockResolvedValue({
			id: "la-2",
			username: "rodrigodev",
			avatarUrl: "https://avatars.githubusercontent.com/u/12345",
			profileUrl: "https://github.com/rodrigodev",
			provider: "GITHUB",
			wallet: {
				id: "w-2",
				address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
				profilePublic: true,
				teamMemberships: [
					{
						id: "tm-1",
						team: {
							id: "t-1",
							name: "Astrea Hackers",
							submissionUrl: "https://github.com/rodrigodev/stellar-escrow",
							submissionVerifiedAt: new Date("2026-09-16T12:00:00Z"),
							event: {
								id: "evt-100",
								name: "Stellar Global Hackathon",
								network: "TESTNET",
								status: "COMPLETED",
							},
							wonPrizes: [
								{
									id: "p-1",
									rank: 1,
									amount: 500,
									payouts: [],
								},
							],
						},
						payouts: [
							{
								id: "pay-1",
								txHash:
									"a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
							},
						],
					},
				],
			},
		});

		const element = await PublicProfilePage({
			params: Promise.resolve({ locale: "en", login: "rodrigodev" }),
		});
		renderWithIntl(element);

		expect(screen.getByText("rodrigodev")).toBeInTheDocument();
		expect(screen.getByText("Stellar Global Hackathon")).toBeInTheDocument();
		expect(screen.getByText("Astrea Hackers")).toBeInTheDocument();
		expect(screen.getByText("500 USDC")).toBeInTheDocument();
		expect(screen.getByTestId("tx-hash-link")).toHaveTextContent(
			"a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
		);
	});

	it("generates correct metadata", async () => {
		const meta = await generateMetadata({
			params: Promise.resolve({ locale: "en", login: "rodrigodev" }),
		});
		expect(meta.title).toBe("rodrigodev — Public Profile | Astrea");
	});
});
