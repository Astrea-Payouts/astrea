import { describe, expect, it } from "vitest";
import {
	getGitHubAuthUrl,
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
