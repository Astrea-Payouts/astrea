"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { STELLAR_ACCOUNT_ID } from "@/lib/stellar-network";

// A UX-convenience "who's browsing as which wallet" cookie — NOT an
// authorization mechanism. It is never checked before a money-moving
// action; every escrow operation is independently authorized by the
// actual on-chain signature (verified by Trustless Work / the Soroban
// contract), regardless of what this cookie claims. See docs/architecture.md
// Principle 1. A future hardening task can upgrade this to a signed
// challenge-response session if UI-level impersonation becomes a concern.
const SESSION_COOKIE = "astrea_wallet_id";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function associateWallet(address: string) {
	if (!STELLAR_ACCOUNT_ID.test(address)) {
		throw new Error("Invalid Stellar address");
	}

	let wallet = await db.wallet.findUnique({ where: { address } });
	if (!wallet) {
		const user = await db.user.create({ data: {} });
		wallet = await db.wallet.create({ data: { address, userId: user.id } });
	}

	const cookieStore = await cookies();
	cookieStore.set(SESSION_COOKIE, wallet.id, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: SESSION_MAX_AGE_SECONDS,
	});

	return {
		userId: wallet.userId,
		walletId: wallet.id,
		address: wallet.address,
	};
}

export async function clearWalletSession() {
	const cookieStore = await cookies();
	cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionWallet() {
	const cookieStore = await cookies();
	const walletId = cookieStore.get(SESSION_COOKIE)?.value;
	if (!walletId) return null;
	return db.wallet.findUnique({ where: { id: walletId } });
}
