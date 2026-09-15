import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CoreGoError,
	CoreGoTransportError,
	releaseBuild,
	releaseSubmit,
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
