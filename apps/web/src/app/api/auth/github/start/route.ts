import crypto from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
	GITHUB_OAUTH_COOKIE,
	getGitHubAuthUrl,
	signOAuthState,
} from "@/lib/github/oauth";
import { getSessionWallet } from "@/lib/wallet/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const session = await getSessionWallet();
	if (!session) {
		const redirectUrl = new URL(
			"/?error=not_connected",
			request.nextUrl.origin,
		);
		return NextResponse.redirect(redirectUrl);
	}

	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		const redirectUrl = new URL(
			"/?error=github_not_configured",
			request.nextUrl.origin,
		);
		return NextResponse.redirect(redirectUrl);
	}

	const returnTo = request.nextUrl.searchParams.get("returnTo") || undefined;
	const nonce = crypto.randomUUID();
	const state = signOAuthState({
		walletId: session.id,
		nonce,
		timestamp: Date.now(),
		returnTo,
	});

	const callbackUrl = new URL(
		"/api/auth/github/callback",
		request.nextUrl.origin,
	).toString();

	const authUrl = getGitHubAuthUrl(state, callbackUrl);

	const cookieStore = await cookies();
	cookieStore.set(GITHUB_OAUTH_COOKIE, state, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 600, // 10 minutes
	});

	return NextResponse.redirect(authUrl);
}
