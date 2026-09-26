import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { readEscrowEvent } from "@/lib/escrow/read-event";
import { GET } from "./route";

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

describe("GET /events/[id]/display.png", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 404 when the event is not found", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost:3000/en/events/missing/display.png"),
			{ params: Promise.resolve({ locale: "en", id: "missing" }) },
		);

		expect(response.status).toBe(404);
	});

	it("returns 404 when the event is in COMPLETED state", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-completed",
			status: "COMPLETED",
			name: "Completed Event",
			organizerWallet: { address: "GDO..." },
			prizes: [],
			judges: [],
			teams: [],
		} as never);

		const response = await GET(
			new Request("http://localhost:3000/en/events/evt-completed/display.png"),
			{ params: Promise.resolve({ locale: "en", id: "evt-completed" }) },
		);

		expect(response.status).toBe(404);
	});

	it("returns 200 with an image when the event is in LIVE state", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-live",
			status: "LIVE",
			name: "Live Hackathon",
			escrowEventId: "0102030405060708090a0b0c0d0e0f10",
			organizerWallet: {
				address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3IFHAY4B2P76",
			},
			judges: [],
			teams: [],
			prizes: [],
		} as never);

		vi.mocked(readEscrowEvent).mockResolvedValue({
			reward: BigInt("50000000000"),
			state: "Active",
		} as never);

		const response = await GET(
			new Request("http://localhost:3000/en/events/evt-live/display.png"),
			{ params: Promise.resolve({ locale: "en", id: "evt-live" }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("image/png");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("returns 200 with an image when the event is in JUDGING state", async () => {
		vi.mocked(db.event.findUnique).mockResolvedValue({
			id: "evt-judging",
			status: "JUDGING",
			name: "Judging Hackathon",
			escrowEventId: "0102030405060708090a0b0c0d0e0f10",
			organizerWallet: {
				address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3IFHAY4B2P76",
			},
			judges: [],
			teams: [],
			prizes: [],
		} as never);

		vi.mocked(readEscrowEvent).mockResolvedValue({
			reward: BigInt("50000000000"),
			state: "Active",
		} as never);

		const response = await GET(
			new Request("http://localhost:3000/en/events/evt-judging/display.png"),
			{ params: Promise.resolve({ locale: "en", id: "evt-judging" }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("image/png");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
});
