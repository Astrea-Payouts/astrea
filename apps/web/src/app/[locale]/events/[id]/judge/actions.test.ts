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

const { mockSession, mockBuild, mockSubmit, mockRevalidate } = vi.hoisted(
	() => ({
		mockSession: vi.fn(),
		mockBuild: vi.fn(),
		mockSubmit: vi.fn(),
		mockRevalidate: vi.fn(),
	}),
);

vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
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

describe("buildRelease", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
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
	});

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
