import { beforeEach, describe, expect, it, vi } from "vitest";

const ORGANIZER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const JUDGE = "GDLWMKYOJYXW4EIE6DNE2K354RTWDDBXDJCZMPICRBPHO3OBIUDWJSNC";
const WALLET = {
	id: "wallet-1",
	userId: "user-1",
	address: ORGANIZER,
	email: null,
	usdcTrustlineVerifiedAt: null,
	createdAt: new Date(),
};

const { mockDb, mockSession, mockRedirect, mockGetLocale } = vi.hoisted(() => ({
	mockDb: { event: { create: vi.fn() } },
	mockSession: vi.fn(),
	mockRedirect: vi.fn(),
	mockGetLocale: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("@/i18n/navigation", () => ({ redirect: mockRedirect }));
vi.mock("next-intl/server", () => ({ getLocale: mockGetLocale }));

const { createDraftEvent, createDraftEventAction } = await import("./actions");

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

const validInput = {
	name: "Vertical slice B1",
	description: "Two prizes, one judge.",
	prizes: ["1.5", "1"],
	judgeAddress: JUDGE,
	judgeName: "Owner (Freighter)",
	judgingDeadlineAt: FUTURE,
	timezone: "America/Argentina/Buenos_Aires",
};

describe("createDraftEvent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
		mockDb.event.create.mockResolvedValue({ id: "event-1" });
	});

	it("refuses without a session wallet, touching nothing", async () => {
		mockSession.mockResolvedValue(null);

		const res = await createDraftEvent(validInput);

		expect(res).toEqual({ ok: false, code: "notConnected" });
		expect(mockDb.event.create).not.toHaveBeenCalled();
	});

	it("refuses an empty or overlong name", async () => {
		expect(await createDraftEvent({ ...validInput, name: "   " })).toEqual({
			ok: false,
			code: "invalidName",
		});
		expect(
			await createDraftEvent({ ...validInput, name: "x".repeat(121) }),
		).toEqual({ ok: false, code: "invalidName" });
		expect(mockDb.event.create).not.toHaveBeenCalled();
	});

	it("refuses an empty prize list", async () => {
		const res = await createDraftEvent({ ...validInput, prizes: [] });

		expect(res).toEqual({ ok: false, code: "noPrizes" });
		expect(mockDb.event.create).not.toHaveBeenCalled();
	});

	it.each([
		["zero", "0"],
		["negative", "-1"],
		["eight decimals", "1.00000001"],
		["not a number", "abc"],
		["blank", ""],
	])("refuses a %s prize amount, naming the row", async (_label, bad) => {
		const res = await createDraftEvent({
			...validInput,
			prizes: ["1", bad],
		});

		expect(res).toEqual({ ok: false, code: "invalidPrize", detail: "#2" });
		expect(mockDb.event.create).not.toHaveBeenCalled();
	});

	it("refuses a malformed judge address", async () => {
		const res = await createDraftEvent({
			...validInput,
			judgeAddress: "GNOTANADDRESS",
		});

		expect(res).toEqual({ ok: false, code: "invalidJudgeAddress" });
		expect(mockDb.event.create).not.toHaveBeenCalled();
	});

	it("refuses a well-formed address with a bad checksum", async () => {
		const res = await createDraftEvent({
			...validInput,
			judgeAddress: `${JUDGE.slice(0, -1)}A`,
		});

		expect(res).toEqual({ ok: false, code: "invalidJudgeAddress" });
	});

	it("refuses the organizer's own wallet as judge", async () => {
		const res = await createDraftEvent({
			...validInput,
			judgeAddress: ORGANIZER,
		});

		expect(res).toEqual({ ok: false, code: "judgeIsOrganizer" });
		expect(mockDb.event.create).not.toHaveBeenCalled();
	});

	it("refuses an empty judge name", async () => {
		const res = await createDraftEvent({ ...validInput, judgeName: " " });

		expect(res).toEqual({ ok: false, code: "invalidJudgeName" });
	});

	it("refuses an unparseable deadline", async () => {
		const res = await createDraftEvent({
			...validInput,
			judgingDeadlineAt: "not-a-date",
		});

		expect(res).toEqual({ ok: false, code: "invalidDeadline" });
	});

	it("refuses a deadline in the past", async () => {
		const res = await createDraftEvent({
			...validInput,
			judgingDeadlineAt: new Date(Date.now() - 60_000).toISOString(),
		});

		expect(res).toEqual({ ok: false, code: "deadlinePast" });
		expect(mockDb.event.create).not.toHaveBeenCalled();
	});

	it("writes Event + Prizes + Judge in one nested create and returns the id", async () => {
		const res = await createDraftEvent(validInput);

		expect(res).toEqual({ ok: true, id: "event-1" });
		expect(mockDb.event.create).toHaveBeenCalledTimes(1);
		const arg = mockDb.event.create.mock.calls[0][0];
		expect(arg.data).toMatchObject({
			organizerId: "user-1",
			organizerWalletId: "wallet-1",
			name: "Vertical slice B1",
			description: "Two prizes, one judge.",
			status: "DRAFT",
			network: "TESTNET",
			timezone: "America/Argentina/Buenos_Aires",
			prizes: {
				create: [
					{ rank: 1, amount: "1.5" },
					{ rank: 2, amount: "1" },
				],
			},
			judges: {
				create: [{ walletAddress: JUDGE, displayName: "Owner (Freighter)" }],
			},
		});
		expect(arg.data.judgingDeadlineAt).toBeInstanceOf(Date);
		expect(arg.data.judgingDeadlineAt.toISOString()).toBe(FUTURE);
		// No escrow id, no on-chain state: the draft is Postgres-only.
		expect(arg.data).not.toHaveProperty("escrowEventId");
	});

	it("stores a blank description as null and falls back to UTC for an unknown zone", async () => {
		await createDraftEvent({
			...validInput,
			description: "  ",
			timezone: "Mars/Olympus",
		});

		const arg = mockDb.event.create.mock.calls[0][0];
		expect(arg.data.description).toBeNull();
		expect(arg.data.timezone).toBe("UTC");
	});

	it("returns writeFailed with the message when Prisma throws", async () => {
		mockDb.event.create.mockRejectedValue(new Error("unique violation"));

		const res = await createDraftEvent(validInput);

		expect(res).toEqual({
			ok: false,
			code: "writeFailed",
			detail: "unique violation",
		});
	});
});

describe("createDraftEventAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
		mockDb.event.create.mockResolvedValue({ id: "event-1" });
		mockGetLocale.mockResolvedValue("en");
	});

	function form(entries: Array<[string, string]>) {
		const fd = new FormData();
		for (const [k, v] of entries) fd.append(k, v);
		return fd;
	}

	it("reads every field (prizes as repeated `prize` entries) and redirects to the fund page", async () => {
		await createDraftEventAction(
			null,
			form([
				["name", "Vertical slice B1"],
				["description", ""],
				["prize", "1.5"],
				["prize", "1"],
				["judgeAddress", JUDGE],
				["judgeName", "Owner"],
				["judgingDeadlineAt", FUTURE],
				["timezone", "UTC"],
			]),
		);

		expect(mockDb.event.create).toHaveBeenCalledTimes(1);
		expect(mockRedirect).toHaveBeenCalledWith({
			href: "/organizer/events/event-1/fund",
			locale: "en",
		});
	});

	it("returns the refusal without redirecting", async () => {
		const res = await createDraftEventAction(null, form([["name", ""]]));

		expect(res).toEqual({ ok: false, code: "invalidName" });
		expect(mockRedirect).not.toHaveBeenCalled();
	});
});
