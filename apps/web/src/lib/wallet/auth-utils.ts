import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { db } from "@/lib/db";
import { STELLAR_ACCOUNT_ID } from "@/lib/stellar-network";

export const AUTH_MESSAGE_PREFIX = "Astrea Authentication";
export const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function formatAuthMessage(address: string, nonce: string): string {
	return `${AUTH_MESSAGE_PREFIX}\nAddress: ${address}\nNonce: ${nonce}`;
}

export async function issueAuthNonce(address: string): Promise<{
	nonce: string;
	message: string;
	expiresAt: number;
}> {
	if (
		!STELLAR_ACCOUNT_ID.test(address) ||
		!StrKey.isValidEd25519PublicKey(address)
	) {
		throw new Error("Invalid Stellar address");
	}

	const now = Date.now();
	// Best-effort prune of expired rows (full cleanup can be a later cron).
	await db.authNonce.deleteMany({
		where: { expiresAt: { lte: new Date(now) } },
	});

	const nonce = crypto.randomUUID();
	const expiresAt = now + NONCE_TTL_MS;
	await db.authNonce.create({
		data: {
			nonce,
			address,
			expiresAt: new Date(expiresAt),
		},
	});

	return {
		nonce,
		message: formatAuthMessage(address, nonce),
		expiresAt,
	};
}

export async function consumeAuthNonce(
	nonce: string,
	address: string,
): Promise<boolean> {
	const entry = await db.authNonce.findUnique({ where: { nonce } });
	if (!entry) return false;

	// Single-use: delete immediately to prevent replay (even on mismatch).
	await db.authNonce.delete({ where: { nonce } });

	if (entry.address !== address) return false;
	if (entry.expiresAt.getTime() <= Date.now()) return false;

	return true;
}

export function verifyStellarSignature(
	address: string,
	message: string,
	signature: string,
): boolean {
	try {
		if (
			!STELLAR_ACCOUNT_ID.test(address) ||
			!StrKey.isValidEd25519PublicKey(address)
		) {
			return false;
		}

		const verifier = Keypair.fromPublicKey(address);
		let sigBuffer: Buffer;
		if (/^[0-9a-fA-F]+$/.test(signature) && signature.length === 128) {
			sigBuffer = Buffer.from(signature, "hex");
		} else {
			sigBuffer = Buffer.from(signature, "base64");
		}

		if (sigBuffer.length !== 64) {
			return false;
		}

		return verifier.verify(Buffer.from(message, "utf-8"), sigBuffer);
	} catch {
		return false;
	}
}
