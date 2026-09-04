import { Keypair } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	consumeAuthNonce,
	formatAuthMessage,
	issueAuthNonce,
	verifyStellarSignature,
} from "./auth-utils";
import {
	associateVerifiedWallet,
	clearWalletSession,
	getAuthNonce,
	getSessionWallet,
	updateWalletEmail,
} from "./session";

const { mockCookieMap, mockDb, nonceRows } = vi.hoisted(() => {
	const nonceRows = new Map<
		string,
		{ nonce: string; address: string; expiresAt: Date }
	>();
	return {
		mockCookieMap: new Map<string, { value: string; options?: unknown }>(),
		nonceRows,
		mockDb: {
			wallet: {
				findUnique: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
			},
			user: {
				create: vi.fn(),
			},
			authNonce: {
				deleteMany: vi.fn(
					async ({ where }: { where: { expiresAt?: { lte: Date } } }) => {
						if (where.expiresAt?.lte) {
							const cutoff = where.expiresAt.lte.getTime();
							for (const [k, v] of nonceRows.entries()) {
								if (v.expiresAt.getTime() <= cutoff) nonceRows.delete(k);
							}
						}
						return { count: 0 };
					},
				),
				create: vi.fn(
					async ({
						data,
					}: {
						data: { nonce: string; address: string; expiresAt: Date };
					}) => {
						nonceRows.set(data.nonce, data);
						return data;
					},
				),
				findUnique: vi.fn(async ({ where }: { where: { nonce: string } }) => {
					return nonceRows.get(where.nonce) ?? null;
				}),
				delete: vi.fn(async ({ where }: { where: { nonce: string } }) => {
					const row = nonceRows.get(where.nonce);
					nonceRows.delete(where.nonce);
					return row;
				}),
			},
		},
	};
});

vi.mock("next/headers", () => ({
	cookies: async () => ({
		get: (name: string) => mockCookieMap.get(name),
		set: (name: string, value: string, options?: unknown) => {
			mockCookieMap.set(name, { value, options });
		},
		delete: (name: string) => {
			mockCookieMap.delete(name);
		},
	}),
}));

vi.mock("@/lib/db", () => ({
	db: mockDb,
}));

describe("S07: Stellar challenge-response auth and session management", () => {
	const keypair = Keypair.random();
	const address = keypair.publicKey();

	beforeEach(() => {
		mockCookieMap.clear();
		nonceRows.clear();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("issueAuthNonce & consumeAuthNonce", () => {
		it("issues a nonce and message for a valid Stellar address", async () => {
			const { nonce, message, expiresAt } = await issueAuthNonce(address);
			expect(nonce).toBeDefined();
			expect(typeof nonce).toBe("string");
			expect(message).toBe(formatAuthMessage(address, nonce));
			expect(expiresAt).toBeGreaterThan(Date.now());
		});

		it("throws an error for an invalid Stellar address", async () => {
			await expect(issueAuthNonce("INVALID_STELLAR_ADDRESS")).rejects.toThrow(
				/Invalid Stellar address/,
			);
		});

		it("consumes a valid nonce successfully and enforces single-use", async () => {
			const { nonce } = await issueAuthNonce(address);
			expect(await consumeAuthNonce(nonce, address)).toBe(true);
			// Replay attempt fails
			expect(await consumeAuthNonce(nonce, address)).toBe(false);
		});

		it("rejects consuming a nonce for a different address", async () => {
			const otherKeypair = Keypair.random();
			const { nonce } = await issueAuthNonce(address);
			expect(await consumeAuthNonce(nonce, otherKeypair.publicKey())).toBe(
				false,
			);
		});

		it("rejects non-existent nonces", async () => {
			expect(await consumeAuthNonce("non-existent-nonce", address)).toBe(false);
		});
	});

	describe("verifyStellarSignature", () => {
		it("verifies a valid Ed25519 signature in base64 format", () => {
			const message = "Astrea Test Message";
			const sig = keypair.sign(Buffer.from(message, "utf-8"));
			const sigBase64 = sig.toString("base64");

			expect(verifyStellarSignature(address, message, sigBase64)).toBe(true);
		});

		it("verifies a valid Ed25519 signature in hex format", () => {
			const message = "Astrea Test Message";
			const sig = keypair.sign(Buffer.from(message, "utf-8"));
			const sigHex = sig.toString("hex");

			expect(verifyStellarSignature(address, message, sigHex)).toBe(true);
		});

		it("rejects a signature created by a different keypair", () => {
			const otherKeypair = Keypair.random();
			const message = "Astrea Test Message";
			const sig = otherKeypair.sign(Buffer.from(message, "utf-8"));

			expect(
				verifyStellarSignature(address, message, sig.toString("base64")),
			).toBe(false);
		});

		it("rejects a signature when the message was tampered with", () => {
			const message = "Astrea Original Message";
			const sig = keypair.sign(Buffer.from(message, "utf-8"));

			expect(
				verifyStellarSignature(
					address,
					"Astrea Tampered Message",
					sig.toString("base64"),
				),
			).toBe(false);
		});

		it("rejects invalid signature encoding or malformed strings", () => {
			expect(verifyStellarSignature(address, "msg", "malformed-sig")).toBe(
				false,
			);
		});
	});

	describe("associateVerifiedWallet", () => {
		it("successfully creates a new user and wallet on first verified connect", async () => {
			const { nonce } = await getAuthNonce(address);
			const message = formatAuthMessage(address, nonce);
			const signature = keypair
				.sign(Buffer.from(message, "utf-8"))
				.toString("base64");

			mockDb.wallet.findUnique.mockResolvedValue(null);
			mockDb.user.create.mockResolvedValue({ id: "user-123" });
			mockDb.wallet.create.mockResolvedValue({
				id: "wallet-456",
				userId: "user-123",
				address,
				email: "user@example.com",
			});

			const result = await associateVerifiedWallet({
				address,
				signature,
				nonce,
				email: "user@example.com",
			});

			expect(result).toEqual({
				userId: "user-123",
				walletId: "wallet-456",
				address,
				email: "user@example.com",
			});
			expect(mockCookieMap.get("astrea_wallet_id")?.value).toBe("wallet-456");
		});

		it("reconnects an existing wallet without creating duplicate users", async () => {
			const { nonce } = await getAuthNonce(address);
			const message = formatAuthMessage(address, nonce);
			const signature = keypair
				.sign(Buffer.from(message, "utf-8"))
				.toString("base64");

			mockDb.wallet.findUnique.mockResolvedValue({
				id: "wallet-existing",
				userId: "user-existing",
				address,
				email: null,
			});

			const result = await associateVerifiedWallet({
				address,
				signature,
				nonce,
			});

			expect(result).toEqual({
				userId: "user-existing",
				walletId: "wallet-existing",
				address,
				email: null,
			});
			expect(mockDb.user.create).not.toHaveBeenCalled();
			expect(mockCookieMap.get("astrea_wallet_id")?.value).toBe(
				"wallet-existing",
			);
		});

		it("rejects unverified connect attempts without a valid nonce", async () => {
			const message = "fake";
			const signature = keypair
				.sign(Buffer.from(message, "utf-8"))
				.toString("base64");

			await expect(
				associateVerifiedWallet({
					address,
					signature,
					nonce: "invalid-nonce",
				}),
			).rejects.toThrow(/Invalid or expired authentication nonce/);
		});

		it("rejects connect attempts with an invalid signature", async () => {
			const { nonce } = await getAuthNonce(address);
			const otherKeypair = Keypair.random();
			const message = formatAuthMessage(address, nonce);
			const badSig = otherKeypair
				.sign(Buffer.from(message, "utf-8"))
				.toString("base64");

			await expect(
				associateVerifiedWallet({
					address,
					signature: badSig,
					nonce,
				}),
			).rejects.toThrow(/Invalid cryptographic signature/);
		});
	});

	describe("updateWalletEmail & getSessionWallet & clearWalletSession", () => {
		it("updates email on the current session wallet", async () => {
			mockCookieMap.set("astrea_wallet_id", { value: "wallet-123" });
			mockDb.wallet.findUnique.mockResolvedValue({
				id: "wallet-123",
				address,
				email: null,
			});
			mockDb.wallet.update.mockResolvedValue({
				id: "wallet-123",
				address,
				email: "updated@example.com",
			});

			const res = await updateWalletEmail("updated@example.com");
			expect(res).toEqual({
				success: true,
				email: "updated@example.com",
			});
			expect(mockDb.wallet.update).toHaveBeenCalledWith({
				where: { id: "wallet-123" },
				data: { email: "updated@example.com" },
			});
		});

		it("throws when updating email without an active session", async () => {
			mockDb.wallet.findUnique.mockResolvedValue(null);
			await expect(updateWalletEmail("fail@example.com")).rejects.toThrow(
				/Not authenticated/,
			);
		});

		it("clears wallet session cookie on disconnect", async () => {
			mockCookieMap.set("astrea_wallet_id", { value: "wallet-123" });
			await clearWalletSession();
			expect(mockCookieMap.get("astrea_wallet_id")).toBeUndefined();
		});

		it("returns session wallet from database", async () => {
			mockCookieMap.set("astrea_wallet_id", { value: "wallet-123" });
			mockDb.wallet.findUnique.mockResolvedValue({
				id: "wallet-123",
				address,
				email: "test@example.com",
			});

			const wallet = await getSessionWallet();
			expect(wallet).toEqual({
				id: "wallet-123",
				address,
				email: "test@example.com",
			});
		});
	});
});
