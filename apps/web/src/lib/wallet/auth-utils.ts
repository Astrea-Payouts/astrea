import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { STELLAR_ACCOUNT_ID } from "@/lib/stellar-network";

export const AUTH_MESSAGE_PREFIX = "Astrea Authentication";
export const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function formatAuthMessage(address: string, nonce: string): string {
	return `${AUTH_MESSAGE_PREFIX}\nAddress: ${address}\nNonce: ${nonce}`;
}

type NonceEntry = {
	address: string;
	expiresAt: number;
};

// Server memory store for active challenge nonces
const nonceStore = new Map<string, NonceEntry>();

export function issueAuthNonce(address: string): {
	nonce: string;
	message: string;
	expiresAt: number;
} {
	if (
		!STELLAR_ACCOUNT_ID.test(address) ||
		!StrKey.isValidEd25519PublicKey(address)
	) {
		throw new Error("Invalid Stellar address");
	}

	const now = Date.now();
	// Prune expired entries
	for (const [key, entry] of nonceStore.entries()) {
		if (entry.expiresAt <= now) {
			nonceStore.delete(key);
		}
	}

	const nonce = crypto.randomUUID();
	const expiresAt = now + NONCE_TTL_MS;
	nonceStore.set(nonce, { address, expiresAt });

	return {
		nonce,
		message: formatAuthMessage(address, nonce),
		expiresAt,
	};
}

export function consumeAuthNonce(nonce: string, address: string): boolean {
	const entry = nonceStore.get(nonce);
	if (!entry) return false;

	// Single-use: delete immediately to prevent replay
	nonceStore.delete(nonce);

	if (entry.address !== address) return false;
	if (entry.expiresAt <= Date.now()) return false;

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
