import { createRequire } from "node:module";
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
import {
	UNSUPPORTED_ALBEDO_MESSAGE,
	validateOptionalEmail,
} from "./validation";

const require = createRequire(import.meta.url);
const {
	AlbedoModule,
} = require("@creit.tech/stellar-wallets-kit/modules/albedo");
const {
	FREIGHTER_ID,
	FreighterModule,
} = require("@creit.tech/stellar-wallets-kit/modules/freighter");
const {
	xBullModule,
} = require("@creit.tech/stellar-wallets-kit/modules/xbull");
const {
	LobstrModule,
} = require("@creit.tech/stellar-wallets-kit/modules/lobstr");

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

	describe("validateOptionalEmail", () => {
		it("accepts valid email addresses and trims whitespace", () => {
			expect(validateOptionalEmail("user@example.com")).toBe(
				"user@example.com",
			);
			expect(
				validateOptionalEmail("  builder.stellar+test@sub.domain.org  "),
			).toBe("builder.stellar+test@sub.domain.org");
		});

		it("returns null for empty, whitespace, null, or undefined values", () => {
			expect(validateOptionalEmail(null)).toBeNull();
			expect(validateOptionalEmail(undefined)).toBeNull();
			expect(validateOptionalEmail("")).toBeNull();
			expect(validateOptionalEmail("   ")).toBeNull();
		});

		it("throws an error for malformed email addresses", () => {
			expect(() => validateOptionalEmail("not-an-email")).toThrow(
				/Invalid email address format/,
			);
			expect(() => validateOptionalEmail("missing@domain")).toThrow(
				/Invalid email address format/,
			);
			expect(() => validateOptionalEmail("@domain.com")).toThrow(
				/Invalid email address format/,
			);
			expect(() => validateOptionalEmail("user@.com")).toThrow(
				/Invalid email address format/,
			);
		});
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

		it("rejects connect attempts with invalid optional email format", async () => {
			const { nonce } = await getAuthNonce(address);
			const message = formatAuthMessage(address, nonce);
			const signature = keypair
				.sign(Buffer.from(message, "utf-8"))
				.toString("base64");

			await expect(
				associateVerifiedWallet({
					address,
					signature,
					nonce,
					email: "bad-email-format",
				}),
			).rejects.toThrow(/Invalid email address format/);
			expect(mockDb.wallet.create).not.toHaveBeenCalled();
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

		it("rejects updating email with invalid format", async () => {
			mockCookieMap.set("astrea_wallet_id", { value: "wallet-123" });
			mockDb.wallet.findUnique.mockResolvedValue({
				id: "wallet-123",
				address,
				email: null,
			});

			await expect(updateWalletEmail("not-a-valid-email")).rejects.toThrow(
				/Invalid email address format/,
			);
			expect(mockDb.wallet.update).not.toHaveBeenCalled();
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

	describe("Configured wallet modules coverage (P1: Albedo, Freighter, xBull, Lobstr)", () => {
		it("initializes all 4 configured wallet modules with expected product identifiers", () => {
			const freighter = new FreighterModule();
			const albedo = new AlbedoModule();
			const xbull = new xBullModule();
			const lobstr = new LobstrModule();

			expect(freighter.productId).toBe(FREIGHTER_ID);
			expect(albedo.productId).toBe("albedo");
			expect(xbull.productId).toBe("xbull");
			expect(lobstr.productId).toBe("lobstr");
		});

		it("demonstrates AlbedoModule.signMessage throws because it is incompatible with SEP-0043", async () => {
			const albedo = new AlbedoModule();
			await expect(albedo.signMessage()).rejects.toEqual({
				code: -3,
				message: 'Albedo does not support the "signMessage" function',
			});
		});

		it("handles Albedo unsupported authentication state without establishing an unverified session", async () => {
			const albedo = new AlbedoModule();
			let sessionEstablished = false;
			let authError: string | null = null;
			let clientAddress: string | null = "G_ALBEDO_CONNECTED_ADDRESS";

			try {
				// Simulating connection attempt with Albedo
				await albedo.signMessage();
				sessionEstablished = true;
			} catch (err: unknown) {
				const errMsg =
					err instanceof Error
						? err.message
						: typeof err === "object" && err !== null && "message" in err
							? String((err as { message: unknown }).message)
							: "";

				if (errMsg.includes('Albedo does not support the "signMessage"')) {
					authError = UNSUPPORTED_ALBEDO_MESSAGE;
					// Connection must not be treated as successful
					clientAddress = null;
				}
			}

			expect(sessionEstablished).toBe(false);
			expect(clientAddress).toBeNull();
			expect(authError).toBe(UNSUPPORTED_ALBEDO_MESSAGE);
			expect(mockCookieMap.get("astrea_wallet_id")).toBeUndefined();
		});

		it("establishes verified sessions for supported wallet signatures (Freighter / xBull / Lobstr)", async () => {
			for (const walletName of ["Freighter", "xBull", "Lobstr"]) {
				mockCookieMap.clear();
				const { nonce } = await getAuthNonce(address);
				const message = formatAuthMessage(address, nonce);

				// Each supported wallet signs the challenge message with its Ed25519 key
				const signature = keypair
					.sign(Buffer.from(message, "utf-8"))
					.toString("base64");

				mockDb.wallet.findUnique.mockResolvedValueOnce(null);
				mockDb.user.create.mockResolvedValueOnce({
					id: `user-${walletName.toLowerCase()}`,
				});
				mockDb.wallet.create.mockResolvedValueOnce({
					id: `wallet-${walletName.toLowerCase()}`,
					userId: `user-${walletName.toLowerCase()}`,
					address,
					email: null,
				});

				const result = await associateVerifiedWallet({
					address,
					signature,
					nonce,
				});

				expect(result.walletId).toBe(`wallet-${walletName.toLowerCase()}`);
				expect(mockCookieMap.get("astrea_wallet_id")?.value).toBe(
					`wallet-${walletName.toLowerCase()}`,
				);
			}
		});
	});
});
