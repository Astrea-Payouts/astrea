import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	exchangeCodeForToken,
	getGitHubAuthUrl,
	getGitHubUser,
	OAUTH_STATE_TTL_MS,
	signOAuthState,
	verifyOAuthState,
} from "./oauth";

describe("OAuth State Signing and Verification", () => {
	const validPayload = {
		walletId: "wallet-abc-123",
		nonce: "nonce-xyz-789",
		timestamp: Date.now(),
		returnTo: "/events/event-1",
	};

	it("signs and successfully verifies state for the matching wallet", () => {
		const signedState = signOAuthState(validPayload);
		expect(typeof signedState).toBe("string");
		expect(signedState.split(".").length).toBe(2);

		const verified = verifyOAuthState(signedState, "wallet-abc-123");
		expect(verified).not.toBeNull();
		expect(verified?.walletId).toBe("wallet-abc-123");
		expect(verified?.nonce).toBe("nonce-xyz-789");
		expect(verified?.returnTo).toBe("/events/event-1");
	});

	it("refuses state when wallet ID does not match expected wallet", () => {
		const signedState = signOAuthState(validPayload);
		const verified = verifyOAuthState(signedState, "different-wallet-id");
		expect(verified).toBeNull();
	});

	it("refuses tampered payload", () => {
		const signedState = signOAuthState(validPayload);
		const [, signature] = signedState.split(".");

		const tamperedPayload = Buffer.from(
			JSON.stringify({ ...validPayload, walletId: "attacker-wallet" }),
		).toString("base64url");

		const tamperedState = `${tamperedPayload}.${signature}`;
		expect(verifyOAuthState(tamperedState)).toBeNull();
	});

	it("refuses tampered signature", () => {
		const signedState = signOAuthState(validPayload);
		const [payload] = signedState.split(".");
		const fakeSignature = Buffer.from("fakesig").toString("base64url");

		const tamperedState = `${payload}.${fakeSignature}`;
		expect(verifyOAuthState(tamperedState)).toBeNull();
	});

	it("refuses expired state", () => {
		const expiredPayload = {
			...validPayload,
			timestamp: Date.now() - (OAUTH_STATE_TTL_MS + 1000),
		};
		const signedState = signOAuthState(expiredPayload);
		expect(verifyOAuthState(signedState)).toBeNull();
	});

	it("handles malformed inputs safely", () => {
		expect(verifyOAuthState("")).toBeNull();
		expect(verifyOAuthState("no-dot-separator")).toBeNull();
		expect(verifyOAuthState("a.b.c")).toBeNull();
		expect(verifyOAuthState("not-json.sig")).toBeNull();
	});
});

describe("getGitHubAuthUrl", () => {
	it("constructs correct authorize URL with state and redirectUri", () => {
		const urlString = getGitHubAuthUrl(
			"test-state-123",
			"https://astrea.app/api/auth/github/callback",
			"test-client-id",
		);
		const url = new URL(urlString);

		expect(url.hostname).toBe("github.com");
		expect(url.pathname).toBe("/login/oauth/authorize");
		expect(url.searchParams.get("state")).toBe("test-state-123");
		expect(url.searchParams.get("redirect_uri")).toBe(
			"https://astrea.app/api/auth/github/callback",
		);
		expect(url.searchParams.get("scope")).toBe("read:user user:email");
	});
});

// exchangeCodeForToken and getGitHubUser read env at call time, so the
// module is mocked with a mutable object the tests below can edit per case.
const envMock = vi.hoisted(() => ({
	GITHUB_CLIENT_ID: "test-client-id" as string | undefined,
	GITHUB_CLIENT_SECRET: "test-client-secret" as string | undefined,
}));
vi.mock("@/lib/env", () => ({ env: envMock }));

function jsonResponse(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("getGitHubAuthUrl client id fallback", () => {
	afterEach(() => {
		envMock.GITHUB_CLIENT_ID = "test-client-id";
	});

	it("falls back to GITHUB_CLIENT_ID from env", () => {
		const url = new URL(getGitHubAuthUrl("s"));
		expect(url.searchParams.get("client_id")).toBe("test-client-id");
		expect(url.searchParams.has("redirect_uri")).toBe(false);
	});

	it("throws when no client id is available", () => {
		envMock.GITHUB_CLIENT_ID = undefined;
		expect(() => getGitHubAuthUrl("s")).toThrow(
			"GITHUB_CLIENT_ID is not configured",
		);
	});
});

describe("exchangeCodeForToken", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		fetchMock.mockReset();
		vi.unstubAllGlobals();
		envMock.GITHUB_CLIENT_ID = "test-client-id";
		envMock.GITHUB_CLIENT_SECRET = "test-client-secret";
	});

	it("posts the code with the credentials and returns the access token", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(200, { access_token: "gho_token" }),
		);

		await expect(
			exchangeCodeForToken("code-1", "https://astrea.app/cb"),
		).resolves.toBe("gho_token");

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://github.com/login/oauth/access_token");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(init?.body as string)).toEqual({
			client_id: "test-client-id",
			client_secret: "test-client-secret",
			code: "code-1",
			redirect_uri: "https://astrea.app/cb",
		});
	});

	it("omits redirect_uri when none is given", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { access_token: "t" }));
		await exchangeCodeForToken("code-2");
		const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
		expect(body).not.toHaveProperty("redirect_uri");
	});

	it("throws before calling GitHub when credentials are missing", async () => {
		envMock.GITHUB_CLIENT_SECRET = undefined;
		await expect(exchangeCodeForToken("code")).rejects.toThrow(
			"GitHub OAuth credentials are not configured",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("throws on a non-2xx response", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(502, {}));
		await expect(exchangeCodeForToken("code")).rejects.toThrow("HTTP 502");
	});

	it("surfaces GitHub's error description when the body carries an error", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(200, {
				error: "bad_verification_code",
				error_description: "The code passed is incorrect or expired.",
			}),
		);
		await expect(exchangeCodeForToken("code")).rejects.toThrow(
			"The code passed is incorrect or expired.",
		);
	});

	it("falls back to a generic message when the body has neither token nor error", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
		await expect(exchangeCodeForToken("code")).rejects.toThrow(
			"Failed to obtain access token",
		);
	});
});

describe("getGitHubUser", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		fetchMock.mockReset();
		vi.unstubAllGlobals();
	});

	it("sends the bearer token and returns the profile", async () => {
		const profile = {
			id: 42,
			login: "octocat",
			avatar_url: "https://avatars.githubusercontent.com/u/42",
			html_url: "https://github.com/octocat",
		};
		fetchMock.mockResolvedValueOnce(jsonResponse(200, profile));

		await expect(getGitHubUser("gho_token")).resolves.toEqual(profile);

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://api.github.com/user");
		const headers = init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer gho_token");
	});

	it("throws on a non-2xx response", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
		await expect(getGitHubUser("bad")).rejects.toThrow("HTTP 401");
	});
});
