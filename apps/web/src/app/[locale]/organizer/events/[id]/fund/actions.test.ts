import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
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
	mockWalletBalance,
	mockDepositBuild,
	mockDepositSubmit,
	mockCreateBuild,
	mockCreateSubmit,
} = vi.hoisted(() => ({
	mockDb: { event: { findUnique: vi.fn() } },
	mockSession: vi.fn(),
	mockRevalidate: vi.fn(),
	mockWalletBalance: vi.fn(),
	mockDepositBuild: vi.fn(),
	mockDepositSubmit: vi.fn(),
	mockCreateBuild: vi.fn(),
	mockCreateSubmit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));
// Keep the real error classes so `instanceof` in failure() holds.
vi.mock("@/lib/core-go/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/core-go/client")>()),
	walletBalance: mockWalletBalance,
	depositBuild: mockDepositBuild,
	depositSubmit: mockDepositSubmit,
	createBuild: mockCreateBuild,
	createSubmit: mockCreateSubmit,
}));

const { CoreGoError, CoreGoTransportError } = await import(
	"@/lib/core-go/client"
);
const {
	readBalance,
	buildDeposit,
	submitDeposit,
	buildCreate,
	submitCreate,
	readEventStatus,
} = await import("./actions");

describe("fund actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
	});

	describe("session and ownership gates", () => {
		it.each([
			["readBalance", () => readBalance(ORGANIZER)],
			["buildDeposit", () => buildDeposit(ORGANIZER, "1")],
			["submitDeposit", () => submitDeposit(ORGANIZER, OP_ID, "XDR")],
			["buildCreate", () => buildCreate(EVENT_ID)],
			["submitCreate", () => submitCreate(EVENT_ID, "XDR")],
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
			expect(mockWalletBalance).not.toHaveBeenCalled();
			expect(mockDepositBuild).not.toHaveBeenCalled();
			expect(mockCreateBuild).not.toHaveBeenCalled();
		});

		it.each([
			["readBalance", () => readBalance(OTHER)],
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
				expect(mockWalletBalance).not.toHaveBeenCalled();
				expect(mockDepositBuild).not.toHaveBeenCalled();
				expect(mockDepositSubmit).not.toHaveBeenCalled();
			},
		);
	});

	describe("readBalance", () => {
		it("asks Go with the session wallet as both path and header", async () => {
			mockWalletBalance.mockResolvedValue({
				address: ORGANIZER,
				balance: "25000000",
			});

			const res = await readBalance(ORGANIZER);

			expect(res).toEqual({ ok: true, balance: "25000000" });
			expect(mockWalletBalance).toHaveBeenCalledWith(ORGANIZER, ORGANIZER);
		});

		it("passes Go's envelope through", async () => {
			mockWalletBalance.mockRejectedValue(
				new CoreGoError(400, "invalid_wallet", "bad address"),
			);

			expect(await readBalance(ORGANIZER)).toEqual({
				ok: false,
				status: 400,
				code: "invalid_wallet",
				message: "bad address",
			});
		});
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
	});

	describe("buildCreate", () => {
		it("returns Go's reward as a string with the escrow id", async () => {
			mockCreateBuild.mockResolvedValue({
				unsignedTransactionXdr: "CCCC",
				reward: 25000000,
				escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
			});

			const res = await buildCreate(EVENT_ID);

			expect(res).toEqual({
				ok: true,
				unsignedTransactionXdr: "CCCC",
				reward: "25000000",
				escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
			});
			expect(mockCreateBuild).toHaveBeenCalledWith(EVENT_ID, ORGANIZER);
		});

		it("passes not_organizer / event_not_draft through verbatim", async () => {
			mockCreateBuild.mockRejectedValue(
				new CoreGoError(409, "event_not_draft", "event is CREATED"),
			);

			expect(await buildCreate(EVENT_ID)).toEqual({
				ok: false,
				status: 409,
				code: "event_not_draft",
				message: "event is CREATED",
			});
		});

		it("maps a non-Go throw to unknown", async () => {
			mockCreateBuild.mockRejectedValue(new Error("boom"));

			expect(await buildCreate(EVENT_ID)).toEqual({
				ok: false,
				status: 0,
				code: "unknown",
				message: "boom",
			});
		});
	});

	describe("submitCreate", () => {
		it("revalidates the public and fund pages on success", async () => {
			mockCreateSubmit.mockResolvedValue({
				txHash: "cre1",
				status: "succeeded",
				escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
			});

			const res = await submitCreate(EVENT_ID, "SIGNED");

			expect(res).toEqual({
				ok: true,
				txHash: "cre1",
				status: "succeeded",
				escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
			});
			expect(mockCreateSubmit).toHaveBeenCalledWith(
				EVENT_ID,
				ORGANIZER,
				"SIGNED",
			);
			expect(mockRevalidate).toHaveBeenCalledWith(
				`/[locale]/events/${EVENT_ID}`,
				"page",
			);
			expect(mockRevalidate).toHaveBeenCalledWith(
				`/[locale]/organizer/events/${EVENT_ID}/fund`,
				"page",
			);
		});

		it("does not revalidate on a refusal", async () => {
			mockCreateSubmit.mockRejectedValue(
				new CoreGoError(409, "envelope_mismatch", "differs"),
			);

			const res = await submitCreate(EVENT_ID, "SIGNED");

			expect(res).toEqual({
				ok: false,
				status: 409,
				code: "envelope_mismatch",
				message: "differs",
			});
			expect(mockRevalidate).not.toHaveBeenCalled();
		});

		it("attaches the confirmed envelope's hash on create_build_replaced", async () => {
			// A real signed envelope, so the hash is the one the network saw.
			const kp = Keypair.random();
			const tx = new TransactionBuilder(
				{
					accountId: () => kp.publicKey(),
					sequenceNumber: () => "1",
					incrementSequenceNumber: () => {},
				},
				{ fee: "100", networkPassphrase: Networks.TESTNET },
			)
				.setTimeout(60)
				.build();
			tx.sign(kp);
			const signed = tx.toXDR();
			mockCreateSubmit.mockRejectedValue(
				new CoreGoError(
					409,
					"create_build_replaced",
					"create build replaced while submit was in flight",
				),
			);

			const res = await submitCreate(EVENT_ID, signed);

			expect(res).toMatchObject({
				ok: false,
				status: 409,
				code: "create_build_replaced",
				txHash: tx.hash().toString("hex"),
			});
			expect(mockRevalidate).not.toHaveBeenCalled();
		});

		it("leaves txHash undefined when the XDR cannot be parsed", async () => {
			mockCreateSubmit.mockRejectedValue(
				new CoreGoError(409, "create_build_replaced", "replaced"),
			);

			const res = await submitCreate(EVENT_ID, "not-xdr");

			expect(res).toMatchObject({ ok: false, code: "create_build_replaced" });
			expect((res as { txHash?: string }).txHash).toBeUndefined();
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
