import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
	exchangeCodeForToken,
	GITHUB_OAUTH_COOKIE,
	getGitHubUser,
	verifyOAuthState,
} from "@/lib/github/oauth";
import { getSessionWallet } from "@/lib/wallet/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const cookieStore = await cookies();
	const session = await getSessionWallet();

	if (!session) {
		const redirectUrl = new URL(
			"/?error=not_connected",
			request.nextUrl.origin,
		);
		return NextResponse.redirect(redirectUrl);
	}

	const searchParams = request.nextUrl.searchParams;
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const ghError = searchParams.get("error");
	const cookieState = cookieStore.get(GITHUB_OAUTH_COOKIE)?.value;

	// Always clear the state cookie once callback is reached
	cookieStore.delete(GITHUB_OAUTH_COOKIE);

	if (ghError) {
		const statePayload =
			state && cookieState && state === cookieState
				? verifyOAuthState(state, session.id)
				: null;
		const returnTo = statePayload?.returnTo;
		const targetPath =
			returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
		const redirectUrl = new URL(targetPath, request.nextUrl.origin);
		redirectUrl.searchParams.set(
			"error",
			ghError === "access_denied" ? "github_cancelled" : "github_error",
		);
		const desc = searchParams.get("error_description");
		if (desc) {
			redirectUrl.searchParams.set("detail", desc);
		}
		return NextResponse.redirect(redirectUrl);
	}

	if (!code || !state || !cookieState || state !== cookieState) {
		const redirectUrl = new URL(
			"/?error=invalid_oauth_state",
			request.nextUrl.origin,
		);
		return NextResponse.redirect(redirectUrl);
	}

	const statePayload = verifyOAuthState(state, session.id);
	if (!statePayload) {
		const redirectUrl = new URL(
			"/?error=invalid_oauth_state",
			request.nextUrl.origin,
		);
		return NextResponse.redirect(redirectUrl);
	}

	try {
		const callbackUrl = new URL(
			"/api/auth/github/callback",
			request.nextUrl.origin,
		).toString();

		const token = await exchangeCodeForToken(code, callbackUrl);
		const githubUser = await getGitHubUser(token);

		// Atomically bind github account to session wallet, replacing any stale links
		await db.$transaction(async (tx) => {
			await tx.linkedAccount.deleteMany({
				where: { walletId: session.id, provider: "GITHUB" },
			});
			await tx.linkedAccount.deleteMany({
				where: { provider: "GITHUB", providerId: String(githubUser.id) },
			});
			await tx.linkedAccount.create({
				data: {
					walletId: session.id,
					provider: "GITHUB",
					providerId: String(githubUser.id),
					username: githubUser.login,
					avatarUrl: githubUser.avatar_url,
					profileUrl: githubUser.html_url,
				},
			});
		});

		const returnTo = statePayload.returnTo;
		const targetPath =
			returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";

		const redirectUrl = new URL(targetPath, request.nextUrl.origin);
		redirectUrl.searchParams.set("github", "linked");
		return NextResponse.redirect(redirectUrl);
	} catch (err) {
		const returnTo = statePayload?.returnTo;
		const targetPath =
			returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
		const redirectUrl = new URL(targetPath, request.nextUrl.origin);
		redirectUrl.searchParams.set("error", "github_link_failed");
		if (err instanceof Error) {
			redirectUrl.searchParams.set("detail", err.message);
		}
		return NextResponse.redirect(redirectUrl);
	}
}
