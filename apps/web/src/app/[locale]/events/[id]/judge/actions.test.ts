import { beforeEach, describe, expect, it, vi } from "vitest";

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const JUDGE = "GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L";
const WALLET = {
	id: "wallet-judge",
	userId: "user-judge",
	address: JUDGE,
	email: null,
	usdcTrustlineVerifiedAt: null,
	createdAt: new Date(),
};

const WINNER_A = "GBXNBZ7Y3KQ2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2U27X";
const WINNER_B = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const {
	mockSession,
	mockBuild,
	mockSubmit,
	mockRevalidate,
	mockDb,
	mockHasTrustline,
} = vi.hoisted(() => ({
	mockSession: vi.fn(),
	mockBuild: vi.fn(),
	mockSubmit: vi.fn(),
	mockRevalidate: vi.fn(),
	mockDb: {
		event: { findUnique: vi.fn() },
		teamMember: { findMany: vi.fn() },
		wallet: { update: vi.fn() },
	},
	mockHasTrustline: vi.fn(),
}));

vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
// Horizon is the only thing stubbed; verifyAndRecordTrustline runs for real
// so the recorded usdcTrustlineVerifiedAt is part of what is tested.
vi.mock("@/lib/trustline/verify-trustline", () => ({
	hasUsdcTrustline: mockHasTrustline,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));
// Keep the real error classes: the action's `instanceof` checks are what
// these tests exercise.
vi.mock("@/lib/core-go/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/core-go/client")>()),
	releaseBuild: mockBuild,
	releaseSubmit: mockSubmit,
}));

const { CoreGoError, CoreGoTransportError } = await import(
	"@/lib/core-go/client"
);
const { buildRelease, submitRelease } = await import("./actions");

const assignments = [{ rank: 1, teamId: "team-1" }];

const judgingEvent = {
	status: "JUDGING",
	judges: [{ walletAddress: JUDGE }],
};
const members = [
	{ wallet: { id: "wallet-a", address: WINNER_A } },
	{ wallet: { id: "wallet-b", address: WINNER_B } },
];

describe("buildRelease", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
		mockDb.event.findUnique.mockResolvedValue(judgingEvent);
		mockDb.teamMember.findMany.mockResolvedValue(members);
		mockDb.wallet.update.mockResolvedValue({});
		mockHasTrustline.mockResolvedValue(true);
		mockBuild.mockResolvedValue({
			eventId: EVENT_ID,
			unsignedTransactionXdr: "AAAA",
			winners: [
				{ rank: 1, teamId: "team-1", teamMemberId: "m1", address: JUDGE },
			],
		});
	});

	it("returns 401 not_connected without a session and never calls Go", async () => {
		mockSession.mockResolvedValue(null);

		const res = await buildRelease(EVENT_ID, assignments);

		expect(res).toEqual({
			ok: false,
			status: 401,
			code: "not_connected",
			message: "",
		});
		expect(mockBuild).not.toHaveBeenCalled();
		expect(mockDb.event.findUnique).not.toHaveBeenCalled();
		expect(mockHasTrustline).not.toHaveBeenCalled();
	});

	it("re-checks every winning member's trustline, recording each verified one, before calling Go", async () => {
		const res = await buildRelease(EVENT_ID, [
			{ rank: 1, teamId: "team-1" },
			{ rank: 2, teamId: "team-2" },
			{ rank: 3, teamId: "team-1" },
		]);

		expect(mockDb.teamMember.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { eventId: EVENT_ID, teamId: { in: ["team-1", "team-2"] } },
			}),
		);
		expect(mockHasTrustline).toHaveBeenCalledTimes(2);
		expect(mockHasTrustline).toHaveBeenCalledWith(WINNER_A);
		expect(mockHasTrustline).toHaveBeenCalledWith(WINNER_B);
		expect(mockDb.wallet.update).toHaveBeenCalledWith({
			where: { id: "wallet-a" },
			data: { usdcTrustlineVerifiedAt: expect.any(Date) },
		});
		expect(mockDb.wallet.update).toHaveBeenCalledWith({
			where: { id: "wallet-b" },
			data: { usdcTrustlineVerifiedAt: expect.any(Date) },
		});
		expect(mockBuild).toHaveBeenCalledTimes(1);
		expect(res.ok).toBe(true);
	});

	it("refuses with missingTrustline naming the asset and the wallet, and never calls Go", async () => {
		mockHasTrustline.mockImplementation(
			async (address: string) => address !== WINNER_B,
		);

		const res = await buildRelease(EVENT_ID, assignments);

		expect(res).toEqual({
			ok: false,
			code: "missingTrustline",
			asset: `USDC:${process.env.USDC_ISSUER as string}`,
			wallets: [WINNER_B],
		});
		expect(mockBuild).not.toHaveBeenCalled();
		// The member that still has it is recorded; the one without is not.
		expect(mockDb.wallet.update).toHaveBeenCalledTimes(1);
		expect(mockDb.wallet.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "wallet-a" } }),
		);
	});

	it("names every wallet without a trustline, in member order", async () => {
		mockHasTrustline.mockResolvedValue(false);

		const res = await buildRelease(EVENT_ID, assignments);

		expect(res).toMatchObject({
			ok: false,
			code: "missingTrustline",
			wallets: [WINNER_A, WINNER_B],
		});
		expect(mockDb.wallet.update).not.toHaveBeenCalled();
		expect(mockBuild).not.toHaveBeenCalled();
	});

	it("maps a Horizon failure during the re-check to code unknown without calling Go", async () => {
		mockHasTrustline.mockRejectedValue(new Error("horizon 503"));

		const res = await buildRelease(EVENT_ID, assignments);

		expect(res).toEqual({
			ok: false,
			status: 0,
			code: "unknown",
			message: "horizon 503",
		});
		expect(mockBuild).not.toHaveBeenCalled();
	});

	it.each([
		[
			"the caller is not the active judge",
			judgingEvent,
			{ ...WALLET, id: "wallet-other", address: WINNER_A },
		],
		["the event is not JUDGING", { ...judgingEvent, status: "LIVE" }, WALLET],
		[
			"the event has no single active judge",
			{ ...judgingEvent, judges: [] },
			WALLET,
		],
		["the event does not exist", null, WALLET],
	])(
		"skips the re-check and lets Go answer when %s",
		async (_label, event, session) => {
			mockDb.event.findUnique.mockResolvedValue(event);
			mockSession.mockResolvedValue(session);
			mockBuild.mockRejectedValue(
				new CoreGoError(403, "not_judge", "wallet is not the event judge"),
			);

			const res = await buildRelease(EVENT_ID, assignments);

			expect(mockDb.teamMember.findMany).not.toHaveBeenCalled();
			expect(mockHasTrustline).not.toHaveBeenCalled();
			expect(mockBuild).toHaveBeenCalledTimes(1);
			expect(res).toMatchObject({ ok: false, code: "not_judge" });
		},
	);

	it("passes the session wallet and assignments to Go and returns the XDR plus winners", async () => {
		const res = await buildRelease(EVENT_ID, assignments);

		expect(mockBuild).toHaveBeenCalledWith(EVENT_ID, JUDGE, assignments);
		expect(res).toEqual({
			ok: true,
			unsignedTransactionXdr: "AAAA",
			winners: [
				{ rank: 1, teamId: "team-1", teamMemberId: "m1", address: JUDGE },
			],
		});
	});

	it("passes a CoreGoError through as {status, code, message} verbatim", async () => {
		mockBuild.mockRejectedValue(
			new CoreGoError(403, "not_judge", "wallet is not the event judge"),
		);

		const res = await buildRelease(EVENT_ID, assignments);

		expect(res).toEqual({
			ok: false,
			status: 403,
			code: "not_judge",
			message: "wallet is not the event judge",
		});
	});

	it("maps a CoreGoTransportError to code transport with the status", async () => {
		mockBuild.mockRejectedValue(
			new CoreGoTransportError(502, "<html>Bad Gateway</html>"),
		);

		const res = await buildRelease(EVENT_ID, assignments);

		expect(res).toMatchObject({ ok: false, status: 502, code: "transport" });
		expect((res as { message: string }).message).toContain("non-JSON");
	});

	it("maps any other error to code unknown", async () => {
		mockBuild.mockRejectedValue(new Error("socket hang up"));

		const res = await buildRelease(EVENT_ID, assignments);

		expect(res).toEqual({
			ok: false,
			status: 0,
			code: "unknown",
			message: "socket hang up",
		});
	});
});

describe("submitRelease", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
		mockSubmit.mockResolvedValue({ txHash: "ee32", status: "succeeded" });
	});

	it("returns 401 not_connected without a session and never calls Go", async () => {
		mockSession.mockResolvedValue(null);

		const res = await submitRelease(EVENT_ID, "BBBB");

		expect(res).toEqual({
			ok: false,
			status: 401,
			code: "not_connected",
			message: "",
		});
		expect(mockSubmit).not.toHaveBeenCalled();
		expect(mockRevalidate).not.toHaveBeenCalled();
	});

	it("submits with the session wallet and revalidates the public page on success", async () => {
		const res = await submitRelease(EVENT_ID, "BBBB");

		expect(mockSubmit).toHaveBeenCalledWith(EVENT_ID, JUDGE, "BBBB");
		expect(res).toEqual({ ok: true, txHash: "ee32", status: "succeeded" });
		expect(mockRevalidate).toHaveBeenCalledWith(
			`/[locale]/events/${EVENT_ID}`,
			"page",
		);
	});

	it("keeps Go's 202 pending status as ok", async () => {
		mockSubmit.mockResolvedValue({ txHash: "ee32", status: "pending" });

		const res = await submitRelease(EVENT_ID, "BBBB");

		expect(res).toEqual({ ok: true, txHash: "ee32", status: "pending" });
	});

	it("passes a CoreGoError through and does not revalidate", async () => {
		mockSubmit.mockRejectedValue(
			new CoreGoError(
				409,
				"envelope_mismatch",
				"signed envelope does not match the built one",
			),
		);

		const res = await submitRelease(EVENT_ID, "BBBB");

		expect(res).toEqual({
			ok: false,
			status: 409,
			code: "envelope_mismatch",
			message: "signed envelope does not match the built one",
		});
		expect(mockRevalidate).not.toHaveBeenCalled();
	});

	it("maps a CoreGoTransportError to code transport and does not revalidate", async () => {
		mockSubmit.mockRejectedValue(new CoreGoTransportError(504, ""));

		const res = await submitRelease(EVENT_ID, "BBBB");

		expect(res).toMatchObject({ ok: false, status: 504, code: "transport" });
		expect(mockRevalidate).not.toHaveBeenCalled();
	});
});
