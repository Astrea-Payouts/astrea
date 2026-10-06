import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { GET } from "./route";

vi.mock("@/lib/db", () => ({
	db: {
		linkedAccount: {
			findFirst: vi.fn(),
		},
	},
}));

describe("GET /card/[login].svg", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a neutral card with 200 and public cache when account is not found", async () => {
		vi.mocked(db.linkedAccount.findFirst).mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost:3000/card/ghost.svg"),
			{ params: Promise.resolve({ login: "ghost" }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("image/svg+xml");
		expect(response.headers.get("cache-control")).toBe("public, max-age=300");

		const svg = await response.text();
		expect(svg).toContain("@ghost");
		expect(svg).toContain("Profile not public");
	});

	it("returns a neutral card when profile is not public", async () => {
		vi.mocked(db.linkedAccount.findFirst).mockResolvedValue({
			id: "la-1",
			provider: "GITHUB",
			username: "private_user",
			wallet: {
				profilePublic: false,
				teamMemberships: [],
			},
		} as never);

		const response = await GET(
			new Request("http://localhost:3000/card/private_user.svg"),
			{ params: Promise.resolve({ login: "private_user" }) },
		);

		expect(response.status).toBe(200);
		const svg = await response.text();
		expect(svg).toContain("@private_user");
		expect(svg).toContain("Profile not public");
	});

	it("returns a public card with statistics when user is found and public", async () => {
		vi.mocked(db.linkedAccount.findFirst).mockResolvedValue({
			id: "la-2",
			provider: "GITHUB",
			username: "alice",
			wallet: {
				profilePublic: true,
				teamMemberships: [
					{
						id: "tm-1",
						team: {
							event: {
								id: "evt-1",
								name: "Stellar Meridian 2026",
								network: "TESTNET",
								status: "COMPLETED",
							},
							wonPrizes: [
								{
									id: "pz-1",
									amount: 1000,
									payouts: [{ id: "po-1", amount: 1000 }],
								},
							],
						},
						payouts: [{ id: "po-1", amount: 1000 }],
					},
					{
						id: "tm-2",
						team: {
							event: {
								id: "evt-2",
								name: "DeFi Hackathon",
								network: "TESTNET",
								status: "COMPLETED",
							},
							wonPrizes: [
								{
									id: "pz-2",
									amount: 250,
									payouts: [{ id: "po-2", amount: 250 }],
								},
							],
						},
						payouts: [{ id: "po-2", amount: 250 }],
					},
				],
			},
		} as never);

		const response = await GET(
			new Request("http://localhost:3000/card/alice.svg?theme=dark"),
			{ params: Promise.resolve({ login: "alice" }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("image/svg+xml");
		expect(response.headers.get("cache-control")).toBe("public, max-age=300");

		const svg = await response.text();
		expect(svg).toContain("@alice");
		expect(svg).toContain("2 events");
		expect(svg).toContain("2 wins");
		expect(svg).toContain("1,250 USDC");
		expect(svg).toContain("Stellar Meridian 2026");
	});

	it("renders light theme when theme=light query parameter is provided", async () => {
		vi.mocked(db.linkedAccount.findFirst).mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost:3000/card/bob.svg?theme=light"),
			{ params: Promise.resolve({ login: "bob" }) },
		);

		expect(response.status).toBe(200);
		const svg = await response.text();
		expect(svg).toContain('fill="#ffffff"'); // light mode background
	});

	it("handles login with .svg extension in params cleanly", async () => {
		vi.mocked(db.linkedAccount.findFirst).mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost:3000/card/carol.svg"),
			{ params: Promise.resolve({ login: "carol.svg" }) },
		);

		expect(response.status).toBe(200);
		const svg = await response.text();
		expect(svg).toContain("@carol");
		expect(svg).not.toContain("@carol.svg");
	});

	it("gracefully catches database exceptions and returns neutral card instead of 500 error", async () => {
		vi.mocked(db.linkedAccount.findFirst).mockRejectedValue(
			new Error("Database disconnected"),
		);

		const response = await GET(
			new Request("http://localhost:3000/card/dave.svg"),
			{ params: Promise.resolve({ login: "dave" }) },
		);

		expect(response.status).toBe(200);
		const svg = await response.text();
		expect(svg).toContain("@dave");
		expect(svg).toContain("Profile not public");
	});
});
