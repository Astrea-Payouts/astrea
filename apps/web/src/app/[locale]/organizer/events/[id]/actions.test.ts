import { beforeEach, describe, expect, it, vi } from "vitest";

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const ORGANIZER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const OTHER = "GDLWMKYOJYXW4EIE6DNE2K354RTWDDBXDJCZMPICRBPHO3OBIUDWJSNC";
const OP_ID = "0123456789abcdef0123456789abcdef";
const WALLET = { id: "wallet-1", userId: "user-1", address: ORGANIZER };

const {
	mockDb,
	mockSession,
	mockRevalidate,
	mockDepositBuild,
	mockDepositSubmit,
} = vi.hoisted(() => ({
	mockDb: { event: { findUnique: vi.fn() } },
	mockSession: vi.fn(),
	mockRevalidate: vi.fn(),
	mockDepositBuild: vi.fn(),
	mockDepositSubmit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));
// Keep the real error classes so `instanceof` in failure() holds.
vi.mock("@/lib/core-go/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/core-go/client")>()),
	depositBuild: mockDepositBuild,
	depositSubmit: mockDepositSubmit,
}));

const { CoreGoConfigError, CoreGoError, CoreGoTransportError } = await import(
	"@/lib/core-go/client"
);
const { buildDeposit, submitDeposit, readEventStatus } = await import(
	"./actions"
);

describe("organizer event actions (shared by /fund and /start)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
	});

	describe("session and ownership gates", () => {
		it.each([
			["buildDeposit", () => buildDeposit(ORGANIZER, "1")],
			["submitDeposit", () => submitDeposit(ORGANIZER, OP_ID, "XDR")],
			["readEventStatus", () => readEventStatus(EVENT_ID)],
		])("%s answers 401 not_connected without a session", async (_n, call) => {
			mockSession.mockResolvedValue(null);

			const res = await call();

			expect(res).toEqual({
				ok: false,
				status: 401,
				code: "not_connected",
				message: "",
			});
			expect(mockDepositBuild).not.toHaveBeenCalled();
			expect(mockDepositSubmit).not.toHaveBeenCalled();
			expect(mockDb.event.findUnique).not.toHaveBeenCalled();
		});

		it.each([
			["buildDeposit", () => buildDeposit(OTHER, "1")],
			["submitDeposit", () => submitDeposit(OTHER, OP_ID, "XDR")],
		])(
			"%s refuses an address that is not the session wallet without calling Go",
			async (_n, call) => {
				const res = await call();

				expect(res).toMatchObject({
					ok: false,
					status: 403,
					code: "not_wallet_owner",
				});
				expect(mockDepositBuild).not.toHaveBeenCalled();
				expect(mockDepositSubmit).not.toHaveBeenCalled();
			},
		);
	});

	describe("buildDeposit / submitDeposit", () => {
		it("builds with the decimal amount and returns opId + XDR", async () => {
			mockDepositBuild.mockResolvedValue({
				opId: OP_ID,
				unsignedTransactionXdr: "DDDD",
			});

			const res = await buildDeposit(ORGANIZER, "2.5");

			expect(res).toEqual({
				ok: true,
				opId: OP_ID,
				unsignedTransactionXdr: "DDDD",
			});
			expect(mockDepositBuild).toHaveBeenCalledWith(
				ORGANIZER,
				ORGANIZER,
				"2.5",
			);
		});

		it("maps invalid_amount verbatim", async () => {
			mockDepositBuild.mockRejectedValue(
				new CoreGoError(400, "invalid_amount", "amount must be > 0"),
			);

			expect(await buildDeposit(ORGANIZER, "0")).toEqual({
				ok: false,
				status: 400,
				code: "invalid_amount",
				message: "amount must be > 0",
			});
		});

		it("submits opId + signed XDR and passes 200/202 through", async () => {
			mockDepositSubmit.mockResolvedValueOnce({
				txHash: "dep1",
				status: "succeeded",
			});
			expect(await submitDeposit(ORGANIZER, OP_ID, "SIGNED")).toEqual({
				ok: true,
				txHash: "dep1",
				status: "succeeded",
			});
			expect(mockDepositSubmit).toHaveBeenCalledWith(
				ORGANIZER,
				ORGANIZER,
				OP_ID,
				"SIGNED",
			);

			mockDepositSubmit.mockResolvedValueOnce({
				txHash: "dep2",
				status: "pending",
			});
			expect(await submitDeposit(ORGANIZER, OP_ID, "SIGNED")).toEqual({
				ok: true,
				txHash: "dep2",
				status: "pending",
			});
		});

		it("maps a transport error to code transport", async () => {
			mockDepositSubmit.mockRejectedValue(
				new CoreGoTransportError(502, "<html>"),
			);

			const res = await submitDeposit(ORGANIZER, OP_ID, "SIGNED");

			expect(res).toMatchObject({ ok: false, status: 502, code: "transport" });
		});

		it("maps a non-Go throw to unknown", async () => {
			mockDepositBuild.mockRejectedValue(new Error("boom"));

			expect(await buildDeposit(ORGANIZER, "1")).toEqual({
				ok: false,
				status: 0,
				code: "unknown",
				message: "boom",
			});
		});

		it("maps a missing CORE_GO_URL to code config", async () => {
			mockDepositBuild.mockRejectedValue(
				new CoreGoConfigError("CORE_GO_URL is not configured"),
			);

			expect(await buildDeposit(ORGANIZER, "1")).toEqual({
				ok: false,
				status: 0,
				code: "config",
				message: "CORE_GO_URL is not configured",
			});
		});
	});

	describe("readEventStatus", () => {
		it("returns the row for the organizer and revalidates once CREATED", async () => {
			mockDb.event.findUnique.mockResolvedValue({
				status: "CREATED",
				escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
				organizerWalletId: "wallet-1",
			});

			const res = await readEventStatus(EVENT_ID);

			expect(res).toEqual({
				ok: true,
				status: "CREATED",
				escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
			});
			expect(mockRevalidate).toHaveBeenCalledWith(
				`/[locale]/events/${EVENT_ID}`,
				"page",
			);
		});

		it("revalidates the public page once LIVE too", async () => {
			mockDb.event.findUnique.mockResolvedValue({
				status: "LIVE",
				escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
				organizerWalletId: "wallet-1",
			});

			const res = await readEventStatus(EVENT_ID);

			expect(res).toMatchObject({ ok: true, status: "LIVE" });
			expect(mockRevalidate).toHaveBeenCalledWith(
				`/[locale]/events/${EVENT_ID}`,
				"page",
			);
		});

		it("does not revalidate while still DRAFT", async () => {
			mockDb.event.findUnique.mockResolvedValue({
				status: "DRAFT",
				escrowEventId: null,
				organizerWalletId: "wallet-1",
			});

			const res = await readEventStatus(EVENT_ID);

			expect(res).toEqual({ ok: true, status: "DRAFT", escrowEventId: null });
			expect(mockRevalidate).not.toHaveBeenCalled();
		});

		it("answers 404 for an unknown event and 403 for another organizer", async () => {
			mockDb.event.findUnique.mockResolvedValueOnce(null);
			expect(await readEventStatus(EVENT_ID)).toMatchObject({
				ok: false,
				status: 404,
				code: "event_not_found",
			});

			mockDb.event.findUnique.mockResolvedValueOnce({
				status: "DRAFT",
				escrowEventId: null,
				organizerWalletId: "wallet-9",
			});
			expect(await readEventStatus(EVENT_ID)).toMatchObject({
				ok: false,
				status: 403,
				code: "not_organizer",
			});
		});
	});
});

describe("readEventStatus with a non-UUID event id", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
	});

	it("answers 404 without querying the database", async () => {
		expect(await readEventStatus("new")).toMatchObject({
			ok: false,
			status: 404,
			code: "event_not_found",
		});
		expect(mockDb.event.findUnique).not.toHaveBeenCalled();
	});
});
