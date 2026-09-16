import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CoreGoError,
	CoreGoTransportError,
	createBuild,
	createSubmit,
	depositBuild,
	depositSubmit,
	releaseBuild,
	releaseSubmit,
	startBuild,
	startQuote,
	startSubmit,
	walletBalance,
} from "./client";

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const WALLET = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const TOKEN = process.env.CORE_GO_SERVICE_TOKEN as string;

function jsonResponse(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("core-go client", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		fetchMock.mockReset();
		vi.unstubAllGlobals();
	});

	it("releaseBuild posts assignments with the bearer token and wallet headers, token never in the URL", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(200, {
				eventId: EVENT_ID,
				unsignedTransactionXdr: "AAAA",
				winners: [
					{ rank: 1, teamId: "t1", teamMemberId: "m1", address: WALLET },
				],
			}),
		);

		const res = await releaseBuild(EVENT_ID, WALLET, [
			{ rank: 1, teamId: "t1" },
		]);

		expect(res.unsignedTransactionXdr).toBe("AAAA");
		expect(res.winners).toHaveLength(1);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		const urlString = url instanceof URL ? url.toString() : String(url);
		expect(urlString).toBe(
			`http://localhost:8080/events/${EVENT_ID}/release/build`,
		);
		expect(urlString).not.toContain(TOKEN);
		expect(init?.method).toBe("POST");
		const headers = init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
		expect(headers["X-Astrea-Wallet"]).toBe(WALLET);
		expect(JSON.parse(String(init?.body))).toEqual({
			assignments: [{ rank: 1, teamId: "t1" }],
		});
	});

	it("releaseSubmit posts the signed XDR to /release/submit and returns the hash", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(200, { txHash: "abc123", status: "succeeded" }),
		);

		const res = await releaseSubmit(EVENT_ID, WALLET, "BBBB");

		expect(res).toEqual({ txHash: "abc123", status: "succeeded" });
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe(
			`http://localhost:8080/events/${EVENT_ID}/release/submit`,
		);
		expect(JSON.parse(String(init?.body))).toEqual({
			signedTransactionXdr: "BBBB",
		});
		const headers = init?.headers as Record<string, string>;
		expect(headers["X-Astrea-Wallet"]).toBe(WALLET);
	});

	it("passes a 202 pending submit through unchanged", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(202, { txHash: "abc123", status: "pending" }),
		);
		const res = await releaseSubmit(EVENT_ID, WALLET, "BBBB");
		expect(res.status).toBe("pending");
	});

	it("maps a 403 error envelope to CoreGoError with status, code and message", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(403, {
				error: {
					code: "not_judge",
					message: "caller's wallet isn't the event's judge",
				},
			}),
		);

		const err = await releaseBuild(EVENT_ID, WALLET, [
			{ rank: 1, teamId: "t1" },
		]).catch((e) => e);

		expect(err).toBeInstanceOf(CoreGoError);
		expect(err.status).toBe(403);
		expect(err.code).toBe("not_judge");
		expect(err.message).toBe("caller's wallet isn't the event's judge");
	});

	it("maps a 409 error envelope to CoreGoError", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(409, {
				error: {
					code: "envelope_mismatch",
					message: "signed envelope does not match the built release",
				},
			}),
		);

		const err = await releaseSubmit(EVENT_ID, WALLET, "BBBB").catch((e) => e);

		expect(err).toBeInstanceOf(CoreGoError);
		expect(err.status).toBe(409);
		expect(err.code).toBe("envelope_mismatch");
		expect(err.message).toContain("does not match");
	});

	it("throws CoreGoTransportError, not CoreGoError, on a non-JSON body", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response("<html>502 Bad Gateway</html>", {
				status: 502,
				headers: { "Content-Type": "text/html" },
			}),
		);

		const err = await releaseSubmit(EVENT_ID, WALLET, "BBBB").catch((e) => e);

		expect(err).toBeInstanceOf(CoreGoTransportError);
		expect(err).not.toBeInstanceOf(CoreGoError);
		expect(err.status).toBe(502);
		expect(err.message).toContain("non-JSON");
	});

	it("throws CoreGoTransportError on a non-OK JSON body that is not Go's envelope", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: "boom" }));

		const err = await releaseSubmit(EVENT_ID, WALLET, "BBBB").catch((e) => e);

		expect(err).toBeInstanceOf(CoreGoTransportError);
		expect(err.status).toBe(500);
	});

	describe("organizer path", () => {
		function lastCall() {
			const [url, init] = fetchMock.mock.calls[0];
			return {
				url: url instanceof URL ? url.toString() : String(url),
				init,
				headers: init?.headers as Record<string, string>,
			};
		}

		it("walletBalance GETs /wallets/{address}/balance with the wallet header and no body", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(200, { address: WALLET, balance: "25000000" }),
			);

			const res = await walletBalance(WALLET, WALLET);

			expect(res).toEqual({ address: WALLET, balance: "25000000" });
			const { url, init, headers } = lastCall();
			expect(url).toBe(`http://localhost:8080/wallets/${WALLET}/balance`);
			expect(url).not.toContain(TOKEN);
			expect(init?.method).toBe("GET");
			expect(init?.body).toBeUndefined();
			expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
			expect(headers["X-Astrea-Wallet"]).toBe(WALLET);
			expect(headers["Content-Type"]).toBeUndefined();
		});

		it("depositBuild posts the decimal amount and returns opId + XDR", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(200, {
					opId: "0123456789abcdef0123456789abcdef",
					unsignedTransactionXdr: "DDDD",
				}),
			);

			const res = await depositBuild(WALLET, WALLET, "2.5");

			expect(res.opId).toBe("0123456789abcdef0123456789abcdef");
			expect(res.unsignedTransactionXdr).toBe("DDDD");
			const { url, init, headers } = lastCall();
			expect(url).toBe(`http://localhost:8080/wallets/${WALLET}/deposit/build`);
			expect(init?.method).toBe("POST");
			expect(headers["Content-Type"]).toBe("application/json");
			expect(JSON.parse(String(init?.body))).toEqual({ amount: "2.5" });
		});

		it("depositSubmit posts opId and signed XDR, passing a 202 through", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(202, { txHash: "dep123", status: "pending" }),
			);

			const res = await depositSubmit(
				WALLET,
				WALLET,
				"0123456789abcdef0123456789abcdef",
				"EEEE",
			);

			expect(res).toEqual({ txHash: "dep123", status: "pending" });
			const { url, init } = lastCall();
			expect(url).toBe(
				`http://localhost:8080/wallets/${WALLET}/deposit/submit`,
			);
			expect(JSON.parse(String(init?.body))).toEqual({
				opId: "0123456789abcdef0123456789abcdef",
				signedTransactionXdr: "EEEE",
			});
		});

		it("createBuild posts an empty object and returns reward + escrowEventId", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(200, {
					unsignedTransactionXdr: "FFFF",
					reward: 25000000,
					escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
				}),
			);

			const res = await createBuild(EVENT_ID, WALLET);

			expect(res.reward).toBe(25000000);
			expect(res.escrowEventId).toBe("58e01828eeeba7090fc21c878f8d28da");
			const { url, init, headers } = lastCall();
			expect(url).toBe(`http://localhost:8080/events/${EVENT_ID}/create/build`);
			expect(init?.method).toBe("POST");
			expect(headers["X-Astrea-Wallet"]).toBe(WALLET);
			expect(JSON.parse(String(init?.body))).toEqual({});
		});

		it("createSubmit posts the signed XDR and returns hash, status and escrowEventId", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(200, {
					txHash: "cre123",
					status: "succeeded",
					escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
				}),
			);

			const res = await createSubmit(EVENT_ID, WALLET, "GGGG");

			expect(res).toEqual({
				txHash: "cre123",
				status: "succeeded",
				escrowEventId: "58e01828eeeba7090fc21c878f8d28da",
			});
			const { url, init } = lastCall();
			expect(url).toBe(
				`http://localhost:8080/events/${EVENT_ID}/create/submit`,
			);
			expect(JSON.parse(String(init?.body))).toEqual({
				signedTransactionXdr: "GGGG",
			});
		});

		it("maps the organizer-path envelopes (403 not_wallet_owner, 409 create_build_replaced) to CoreGoError", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(403, {
					error: { code: "not_wallet_owner", message: "not the caller" },
				}),
			);
			const e1 = await walletBalance(WALLET, "GOTHER").catch((e) => e);
			expect(e1).toBeInstanceOf(CoreGoError);
			expect(e1.status).toBe(403);
			expect(e1.code).toBe("not_wallet_owner");

			fetchMock.mockResolvedValueOnce(
				jsonResponse(409, {
					error: {
						code: "create_build_replaced",
						message: "confirmed against a replaced build",
					},
				}),
			);
			const e2 = await createSubmit(EVENT_ID, WALLET, "GGGG").catch((e) => e);
			expect(e2).toBeInstanceOf(CoreGoError);
			expect(e2.status).toBe(409);
			expect(e2.code).toBe("create_build_replaced");
			expect(e2.message).toContain("replaced");
		});

		it("startQuote GETs /events/{id}/start/quote and returns the three stroop strings", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(200, { fee: "500", balance: "200", shortfall: "300" }),
			);

			const res = await startQuote(EVENT_ID, WALLET);

			expect(res).toEqual({ fee: "500", balance: "200", shortfall: "300" });
			const { url, init, headers } = lastCall();
			expect(url).toBe(`http://localhost:8080/events/${EVENT_ID}/start/quote`);
			expect(init?.method).toBe("GET");
			expect(init?.body).toBeUndefined();
			expect(headers["X-Astrea-Wallet"]).toBe(WALLET);
		});

		it("startBuild posts an empty object and returns XDR, judgingDeadline and fee", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(200, {
					unsignedTransactionXdr: "HHHH",
					judgingDeadline: 1780000000,
					fee: 500,
				}),
			);

			const res = await startBuild(EVENT_ID, WALLET);

			expect(res).toEqual({
				unsignedTransactionXdr: "HHHH",
				judgingDeadline: 1780000000,
				fee: 500,
			});
			const { url, init } = lastCall();
			expect(url).toBe(`http://localhost:8080/events/${EVENT_ID}/start/build`);
			expect(init?.method).toBe("POST");
			expect(JSON.parse(String(init?.body))).toEqual({});
		});

		it("startSubmit posts the signed XDR and passes a 202 through", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(202, { txHash: "sta123", status: "pending" }),
			);

			const res = await startSubmit(EVENT_ID, WALLET, "IIII");

			expect(res).toEqual({ txHash: "sta123", status: "pending" });
			const { url, init } = lastCall();
			expect(url).toBe(`http://localhost:8080/events/${EVENT_ID}/start/submit`);
			expect(JSON.parse(String(init?.body))).toEqual({
				signedTransactionXdr: "IIII",
			});
		});

		it("maps the go-live envelopes (409 insufficient_balance, deadline_past) to CoreGoError", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(409, {
					error: {
						code: "insufficient_balance",
						message: "fee 500, balance 200, shortfall 300",
					},
				}),
			);
			const e1 = await startBuild(EVENT_ID, WALLET).catch((e) => e);
			expect(e1).toBeInstanceOf(CoreGoError);
			expect(e1.status).toBe(409);
			expect(e1.code).toBe("insufficient_balance");
			expect(e1.message).toContain("shortfall 300");

			fetchMock.mockResolvedValueOnce(
				jsonResponse(409, {
					error: { code: "deadline_past", message: "deadline is in the past" },
				}),
			);
			const e2 = await startBuild(EVENT_ID, WALLET).catch((e) => e);
			expect(e2).toBeInstanceOf(CoreGoError);
			expect(e2.code).toBe("deadline_past");
		});

		it("throws CoreGoTransportError on a non-JSON balance response", async () => {
			fetchMock.mockResolvedValueOnce(
				new Response("upstream down", { status: 503 }),
			);

			const err = await walletBalance(WALLET, WALLET).catch((e) => e);

			expect(err).toBeInstanceOf(CoreGoTransportError);
			expect(err.status).toBe(503);
		});
	});

	describe("without CORE_GO_URL / CORE_GO_SERVICE_TOKEN", () => {
		// env parses on first access and caches per module instance, so the
		// var must be absent while a freshly imported client makes its call.
		async function callWithout(
			name: "CORE_GO_URL" | "CORE_GO_SERVICE_TOKEN",
			call: (mod: typeof import("./client")) => Promise<unknown>,
		) {
			vi.resetModules();
			const saved = process.env[name];
			delete process.env[name];
			try {
				const mod = await import("./client");
				const err: unknown = await call(mod).catch((e: unknown) => e);
				return { mod, err };
			} finally {
				process.env[name] = saved;
			}
		}

		it("throws CoreGoConfigError naming CORE_GO_URL before any fetch", async () => {
			const { mod, err } = await callWithout("CORE_GO_URL", (m) =>
				m.releaseBuild(EVENT_ID, WALLET, []),
			);

			expect(err).toBeInstanceOf(mod.CoreGoConfigError);
			expect((err as Error).message).toBe("CORE_GO_URL is not configured");
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("throws CoreGoConfigError naming CORE_GO_SERVICE_TOKEN before any fetch", async () => {
			const { mod, err } = await callWithout("CORE_GO_SERVICE_TOKEN", (m) =>
				m.releaseSubmit(EVENT_ID, WALLET, "BBBB"),
			);

			expect(err).toBeInstanceOf(mod.CoreGoConfigError);
			expect((err as Error).message).toBe(
				"CORE_GO_SERVICE_TOKEN is not configured",
			);
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
});
