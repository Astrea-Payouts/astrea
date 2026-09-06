import { describe, expect, it } from "vitest";
import {
	buildStellarLabTrustlineUrl,
	calculateParticipantStep,
	canSubmitProject,
	truncateStellarKey,
	validateSubmissionUrl,
} from "@/lib/participant/participant-helpers";
import type { ParticipantRegistration } from "@/lib/participant/types";

describe("Participant Flow End-to-End Logic (U04)", () => {
	const mockPublicKey =
		"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
	const eventId = "hackathon-2026";

	describe("Registration & State Sequencing", () => {
		it("initializes in CONNECT_WALLET state when no wallet is attached", () => {
			const step = calculateParticipantStep({
				isWalletConnected: false,
				isRegistered: false,
				trustlineStatus: "IDLE",
				hasSubmission: false,
				eventStatus: "LIVE",
			});
			expect(step).toBe("CONNECT_WALLET");
		});

		it("transitions to REGISTER once wallet connects", () => {
			const step = calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: false,
				trustlineStatus: "IDLE",
				hasSubmission: false,
				eventStatus: "LIVE",
			});
			expect(step).toBe("REGISTER");
		});

		it("requires TRUSTLINE_CHECK if registered but trustline is missing", () => {
			const step = calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: true,
				trustlineStatus: "MISSING",
				hasSubmission: false,
				eventStatus: "LIVE",
			});
			expect(step).toBe("TRUSTLINE_CHECK");
		});

		it("allows SUBMIT_PROJECT once registered and trustline is verified active", () => {
			const step = calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: true,
				trustlineStatus: "ACTIVE",
				hasSubmission: false,
				eventStatus: "LIVE",
			});
			expect(step).toBe("SUBMIT_PROJECT");
		});

		it("enters UNDER_REVIEW during judging phase after submission", () => {
			const step = calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: true,
				trustlineStatus: "ACTIVE",
				hasSubmission: true,
				eventStatus: "JUDGING",
			});
			expect(step).toBe("UNDER_REVIEW");
		});

		it("enters COMPLETED once event concludes", () => {
			const step = calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: true,
				trustlineStatus: "ACTIVE",
				hasSubmission: true,
				eventStatus: "COMPLETED",
			});
			expect(step).toBe("COMPLETED");
		});
	});

	describe("Submission Validation & Gating", () => {
		it("prevents submission if trustline is not active (ADR-004 prevention)", () => {
			expect(
				canSubmitProject({
					isRegistered: true,
					trustlineStatus: "MISSING",
					eventStatus: "LIVE",
				}),
			).toBe(false);

			expect(
				canSubmitProject({
					isRegistered: true,
					trustlineStatus: "CHECKING",
					eventStatus: "LIVE",
				}),
			).toBe(false);

			expect(
				canSubmitProject({
					isRegistered: true,
					trustlineStatus: "ACTIVE",
					eventStatus: "LIVE",
				}),
			).toBe(true);
		});

		it("rejects invalid or empty project URLs", () => {
			expect(validateSubmissionUrl("").isValid).toBe(false);
			expect(validateSubmissionUrl("   ").isValid).toBe(false);
			expect(validateSubmissionUrl("javascript:alert(1)").isValid).toBe(false);
			expect(validateSubmissionUrl("htp://typo.com").isValid).toBe(false);
		});

		it("accepts valid HTTP/HTTPS URLs", () => {
			const result = validateSubmissionUrl(
				"https://github.com/my-org/soroban-dex",
			);
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe("Custom Organizer Questions Serialization (U17 Ready)", () => {
		it("formats participant registration with optional questions answers", () => {
			const reg: ParticipantRegistration = {
				eventId,
				walletAddress: mockPublicKey,
				registeredAt: new Date().toISOString(),
				answers: [
					{
						questionId: "q1",
						questionLabel: "Team Name",
						value: "Soroban Pioneers",
					},
					{
						questionId: "q2",
						questionLabel: "Attending in person?",
						value: true,
					},
				],
			};

			expect(reg.eventId).toBe(eventId);
			expect(reg.walletAddress).toBe(mockPublicKey);
			expect(reg.answers).toHaveLength(2);
			expect(reg.answers?.[0].value).toBe("Soroban Pioneers");
			expect(reg.answers?.[1].value).toBe(true);
		});
	});

	describe("Stellar Key Formatter & URL Guidance", () => {
		it("formats truncated public key", () => {
			expect(truncateStellarKey(mockPublicKey)).toBe("GBBD47…LLFLA5");
		});

		it("builds correct lab URL for trustline guidance", () => {
			const labUrl = buildStellarLabTrustlineUrl(mockPublicKey, "testnet");
			expect(labUrl).toContain("laboratory.stellar.org/#txbuilder");
			expect(labUrl).toContain("asset_code=USDC");
			expect(labUrl).toContain(`source=${mockPublicKey}`);
		});
	});
});
