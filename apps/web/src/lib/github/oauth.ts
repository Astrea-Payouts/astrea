import crypto from "node:crypto";
import { env } from "@/lib/env";

export const GITHUB_OAUTH_COOKIE = "astrea_github_oauth_state";
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface OAuthStatePayload {
	walletId: string;
	nonce: string;
	timestamp: number;
	returnTo?: string;
}

function getSigningSecret(): string {
	return env.GITHUB_CLIENT_SECRET || "astrea_github_oauth_signing_fallback_key";
}

/**
 * Creates an HMAC-SHA256 signed state string bound to the wallet session ID.
 */
export function signOAuthState(payload: OAuthStatePayload): string {
	const json = JSON.stringify(payload);
	const encodedPayload = Buffer.from(json, "utf-8").toString("base64url");
	const signature = crypto
		.createHmac("sha256", getSigningSecret())
		.update(encodedPayload)
		.digest("base64url");

	return `${encodedPayload}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed state string.
 * Validates integrity, expiration, and optionally that it matches expectedWalletId.
 */
export function verifyOAuthState(
	stateString: string,
	expectedWalletId?: string,
): OAuthStatePayload | null {
	if (!stateString || typeof stateString !== "string") {
		return null;
	}

	const parts = stateString.split(".");
	if (parts.length !== 2) {
		return null;
	}

	const [encodedPayload, signature] = parts;
	const expectedSignature = crypto
		.createHmac("sha256", getSigningSecret())
		.update(encodedPayload)
		.digest("base64url");

	// Constant-time signature comparison to prevent timing attacks
	if (
		signature.length !== expectedSignature.length ||
		!crypto.timingSafeEqual(
			Buffer.from(signature, "utf-8"),
			Buffer.from(expectedSignature, "utf-8"),
		)
	) {
		return null;
	}

	try {
		const json = Buffer.from(encodedPayload, "base64url").toString("utf-8");
		const payload = JSON.parse(json) as OAuthStatePayload;

		if (
			!payload.walletId ||
			!payload.nonce ||
			typeof payload.timestamp !== "number"
		) {
			return null;
		}

		if (Date.now() - payload.timestamp > OAUTH_STATE_TTL_MS) {
			return null; // Expired
		}

		if (expectedWalletId && payload.walletId !== expectedWalletId) {
			return null; // Wallet session mismatch
		}

		return payload;
	} catch {
		return null;
	}
}

/**
 * Returns GitHub authorization URL with required scopes.
 */
export function getGitHubAuthUrl(
	state: string,
	redirectUri?: string,
	clientId?: string,
): string {
	const activeClientId = clientId || env.GITHUB_CLIENT_ID;
	if (!activeClientId) {
		throw new Error("GITHUB_CLIENT_ID is not configured");
	}

	const url = new URL("https://github.com/login/oauth/authorize");
	url.searchParams.set("client_id", activeClientId);
	url.searchParams.set("state", state);
	url.searchParams.set("scope", "read:user user:email");
	if (redirectUri) {
		url.searchParams.set("redirect_uri", redirectUri);
	}

	return url.toString();
}

/**
 * Exchanges OAuth temporary code for access token with GitHub.
 */
export async function exchangeCodeForToken(
	code: string,
	redirectUri?: string,
): Promise<string> {
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		throw new Error("GitHub OAuth credentials are not configured");
	}

	const response = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
			...(redirectUri ? { redirect_uri: redirectUri } : {}),
		}),
	});

	if (!response.ok) {
		throw new Error(`GitHub token exchange failed: HTTP ${response.status}`);
	}

	const data = (await response.json()) as {
		access_token?: string;
		error?: string;
		error_description?: string;
	};

	if (data.error || !data.access_token) {
		throw new Error(
			data.error_description || data.error || "Failed to obtain access token",
		);
	}

	return data.access_token;
}

export interface GitHubUserProfile {
	id: number;
	login: string;
	avatar_url: string;
	html_url: string;
	name?: string | null;
	email?: string | null;
}

/**
 * Fetches authenticated user profile from GitHub API.
 */
export async function getGitHubUser(token: string): Promise<GitHubUserProfile> {
	const response = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": "Astrea-App",
			Accept: "application/vnd.github.v3+json",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch GitHub user: HTTP ${response.status}`);
	}

	return (await response.json()) as GitHubUserProfile;
}
