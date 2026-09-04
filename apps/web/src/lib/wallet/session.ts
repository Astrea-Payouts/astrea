"use server";

import { StrKey } from "@stellar/stellar-sdk";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { STELLAR_ACCOUNT_ID } from "@/lib/stellar-network";
import {
	consumeAuthNonce,
	formatAuthMessage,
	issueAuthNonce,
	verifyStellarSignature,
} from "./auth-utils";

// S07 — Sign-In With Stellar (SEP-0043):
// Upgrades the session cookie from an unverified client-asserted address to
// a cryptographically verified challenge-response session. The server issues
// a short-lived, single-use nonce; the wallet signs it via SEP-0043's signMessage;
// and the server verifies the Ed25519 signature against the claimed public key.
//
// NOTE: No money-moving action ever trusts this session alone. Every escrow
// operation is independently authorized on-chain by the smart contract or
// multisig signing requirements.
const SESSION_COOKIE = "astrea_wallet_id";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function getAuthNonce(address: string) {
	return await issueAuthNonce(address);
}

export async function associateVerifiedWallet({
	address,
	signature,
	nonce,
	email,
}: {
	address: string;
	signature: string;
	nonce: string;
	email?: string | null;
}) {
	if (
		!STELLAR_ACCOUNT_ID.test(address) ||
		!StrKey.isValidEd25519PublicKey(address)
	) {
		throw new Error("Invalid Stellar address");
	}

	const nonceValid = await consumeAuthNonce(nonce, address);
	if (!nonceValid) {
		throw new Error("Invalid or expired authentication nonce");
	}

	const message = formatAuthMessage(address, nonce);
	const signatureValid = verifyStellarSignature(address, message, signature);
	if (!signatureValid) {
		throw new Error("Invalid cryptographic signature for address");
	}

	let wallet = await db.wallet.findUnique({ where: { address } });
	if (!wallet) {
		const user = await db.user.create({ data: {} });
		wallet = await db.wallet.create({
			data: {
				address,
				userId: user.id,
				email: email?.trim() || null,
			},
		});
	} else if (email !== undefined) {
		wallet = await db.wallet.update({
			where: { id: wallet.id },
			data: { email: email?.trim() || null },
		});
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
		email: wallet.email,
	};
}

export async function updateWalletEmail(email: string | null) {
	const sessionWallet = await getSessionWallet();
	if (!sessionWallet) {
		throw new Error("Not authenticated");
	}

	const updated = await db.wallet.update({
		where: { id: sessionWallet.id },
		data: { email: email?.trim() || null },
	});

	return {
		success: true,
		email: updated.email,
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
