import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const ORGANIZER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const WALLET = { id: "wallet-1", userId: "user-1", address: ORGANIZER };

const {
	mockSession,
	mockRevalidate,
	mockStartQuote,
	mockStartBuild,
	mockStartSubmit,
} = vi.hoisted(() => ({
	mockSession: vi.fn(),
	mockRevalidate: vi.fn(),
	mockStartQuote: vi.fn(),
	mockStartBuild: vi.fn(),
	mockStartSubmit: vi.fn(),
}));

vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));
// Keep the real error classes so `instanceof` in failure() holds.
vi.mock("@/lib/core-go/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/core-go/client")>()),
	startQuote: mockStartQuote,
	startBuild: mockStartBuild,
	startSubmit: mockStartSubmit,
}));

const { CoreGoError, CoreGoTransportError } = await import(
	"@/lib/core-go/client"
);
const { readQuote, buildStart, submitStart } = await import("./actions");

describe("start actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
	});

	it.each([
		["readQuote", () => readQuote(EVENT_ID)],
		["buildStart", () => buildStart(EVENT_ID)],
		["submitStart", () => submitStart(EVENT_ID, "XDR")],
	])("%s answers 401 not_connected without a session", async (_n, call) => {
		mockSession.mockResolvedValue(null);

		const res = await call();

		expect(res).toEqual({
			ok: false,
			status: 401,
			code: "not_connected",
			message: "",
		});
		expect(mockStartQuote).not.toHaveBeenCalled();
		expect(mockStartBuild).not.toHaveBeenCalled();
		expect(mockStartSubmit).not.toHaveBeenCalled();
	});

	describe("readQuote", () => {
		it("asks Go as the session wallet and returns the three stroop strings", async () => {
			mockStartQuote.mockResolvedValue({
				fee: "500",
				balance: "200",
				shortfall: "300",
			});

			const res = await readQuote(EVENT_ID);

			expect(res).toEqual({
				ok: true,
				fee: "500",
				balance: "200",
				shortfall: "300",
			});
			expect(mockStartQuote).toHaveBeenCalledWith(EVENT_ID, ORGANIZER);
		});

		it.each([
			[409, "event_not_created", "event is LIVE"],
			[409, "event_not_on_chain", "no escrowEventId"],
			[403, "not_organizer", "not the organizer"],
		])("passes %i %s through verbatim", async (status, code, message) => {
			mockStartQuote.mockRejectedValue(new CoreGoError(status, code, message));

			expect(await readQuote(EVENT_ID)).toEqual({
				ok: false,
				status,
				code,
				message,
			});
		});
	});

	describe("buildStart", () => {
		it("returns the XDR with Go's deadline and fee as strings", async () => {
			mockStartBuild.mockResolvedValue({
				unsignedTransactionXdr: "SSSS",
				judgingDeadline: 1780000000,
				fee: 500,
			});

			const res = await buildStart(EVENT_ID);

			expect(res).toEqual({
				ok: true,
				unsignedTransactionXdr: "SSSS",
				judgingDeadline: 1780000000,
				fee: "500",
			});
			expect(mockStartBuild).toHaveBeenCalledWith(EVENT_ID, ORGANIZER);
		});

		it.each([
			[409, "deadline_missing", "judgingDeadlineAt is null"],
			[409, "deadline_past", "judgingDeadlineAt is not in the future"],
			[409, "insufficient_balance", "fee 500, balance 200, shortfall 300"],
			[409, "event_not_created", "event is LIVE"],
			[409, "start_already_succeeded", "already live"],
			[502, "simulation_failed", "trap"],
		])("passes %i %s through verbatim", async (status, code, message) => {
			mockStartBuild.mockRejectedValue(new CoreGoError(status, code, message));

			expect(await buildStart(EVENT_ID)).toEqual({
				ok: false,
				status,
				code,
				message,
			});
		});

		it("maps a transport error to code transport and a plain throw to unknown", async () => {
			mockStartBuild.mockRejectedValueOnce(
				new CoreGoTransportError(502, "<html>"),
			);
			expect(await buildStart(EVENT_ID)).toMatchObject({
				ok: false,
				status: 502,
				code: "transport",
			});

			mockStartBuild.mockRejectedValueOnce(new Error("boom"));
			expect(await buildStart(EVENT_ID)).toEqual({
				ok: false,
				status: 0,
				code: "unknown",
				message: "boom",
			});
		});
	});

	describe("submitStart", () => {
		it("revalidates the public and start pages on success", async () => {
			mockStartSubmit.mockResolvedValue({
				txHash: "sta1",
				status: "succeeded",
			});

			const res = await submitStart(EVENT_ID, "SIGNED");

			expect(res).toEqual({ ok: true, txHash: "sta1", status: "succeeded" });
			expect(mockStartSubmit).toHaveBeenCalledWith(
				EVENT_ID,
				ORGANIZER,
				"SIGNED",
			);
			expect(mockRevalidate).toHaveBeenCalledWith(
				`/[locale]/events/${EVENT_ID}`,
				"page",
			);
			expect(mockRevalidate).toHaveBeenCalledWith(
				`/[locale]/organizer/events/${EVENT_ID}/start`,
				"page",
			);
		});

		it("passes a 202 pending through and still revalidates", async () => {
			mockStartSubmit.mockResolvedValue({ txHash: "sta2", status: "pending" });

			expect(await submitStart(EVENT_ID, "SIGNED")).toEqual({
				ok: true,
				txHash: "sta2",
				status: "pending",
			});
		});

		it.each([
			[409, "no_pending_start", "build first"],
			[409, "start_already_succeeded", "already live"],
			[409, "envelope_mismatch", "differs"],
			[502, "on_chain_failed", "trap"],
		])("passes %i %s through without revalidating", async (status, code, m) => {
			mockStartSubmit.mockRejectedValue(new CoreGoError(status, code, m));

			expect(await submitStart(EVENT_ID, "SIGNED")).toEqual({
				ok: false,
				status,
				code,
				message: m,
			});
			expect(mockRevalidate).not.toHaveBeenCalled();
		});

		it("attaches the confirmed envelope's hash on start_build_replaced", async () => {
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
			mockStartSubmit.mockRejectedValue(
				new CoreGoError(
					409,
					"start_build_replaced",
					"start build replaced while submit was in flight",
				),
			);

			const res = await submitStart(EVENT_ID, tx.toXDR());

			expect(res).toMatchObject({
				ok: false,
				status: 409,
				code: "start_build_replaced",
				txHash: tx.hash().toString("hex"),
			});
			expect(mockRevalidate).not.toHaveBeenCalled();
		});

		it("leaves txHash undefined when the XDR cannot be parsed", async () => {
			mockStartSubmit.mockRejectedValue(
				new CoreGoError(409, "start_build_replaced", "replaced"),
			);

			const res = await submitStart(EVENT_ID, "not-xdr");

			expect(res).toMatchObject({ ok: false, code: "start_build_replaced" });
			expect((res as { txHash?: string }).txHash).toBeUndefined();
		});
	});
});
