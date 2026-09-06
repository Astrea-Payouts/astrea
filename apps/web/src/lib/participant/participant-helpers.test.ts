import { describe, expect, it } from "vitest";
import {
	buildStellarLabTrustlineUrl,
	calculateParticipantStep,
	canSubmitProject,
	truncateStellarKey,
	validateSubmissionUrl,
} from "./participant-helpers";

describe("Participant Helpers (U04)", () => {
	const sampleKey = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

	it("truncates Stellar public keys cleanly", () => {
		expect(truncateStellarKey(sampleKey)).toBe("GBBD47…LLFLA5");
		expect(truncateStellarKey("SHORT")).toBe("SHORT");
	});

	it("generates correct Stellar laboratory trustline URL", () => {
		const url = buildStellarLabTrustlineUrl(sampleKey, "testnet");
		expect(url).toContain("laboratory.stellar.org");
		expect(url).toContain(`network=testnet`);
		expect(url).toContain(`source=${sampleKey}`);
		expect(url).toContain("asset_code=USDC");
	});

	it("calculates sequential participant progress steps", () => {
		expect(
			calculateParticipantStep({
				isWalletConnected: false,
				isRegistered: false,
				trustlineStatus: "IDLE",
				hasSubmission: false,
				eventStatus: "LIVE",
			}),
		).toBe("CONNECT_WALLET");

		expect(
			calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: false,
				trustlineStatus: "IDLE",
				hasSubmission: false,
				eventStatus: "LIVE",
			}),
		).toBe("REGISTER");

		expect(
			calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: true,
				trustlineStatus: "MISSING",
				hasSubmission: false,
				eventStatus: "LIVE",
			}),
		).toBe("TRUSTLINE_CHECK");

		expect(
			calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: true,
				trustlineStatus: "ACTIVE",
				hasSubmission: false,
				eventStatus: "LIVE",
			}),
		).toBe("SUBMIT_PROJECT");

		expect(
			calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: true,
				trustlineStatus: "ACTIVE",
				hasSubmission: true,
				eventStatus: "JUDGING",
			}),
		).toBe("UNDER_REVIEW");

		expect(
			calculateParticipantStep({
				isWalletConnected: true,
				isRegistered: true,
				trustlineStatus: "ACTIVE",
				hasSubmission: true,
				eventStatus: "COMPLETED",
			}),
		).toBe("COMPLETED");
	});

	it("gates project submission on registration, trustline, and event status", () => {
		expect(
			canSubmitProject({
				isRegistered: false,
				trustlineStatus: "ACTIVE",
				eventStatus: "LIVE",
			}),
		).toBe(false);

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
				trustlineStatus: "ACTIVE",
				eventStatus: "JUDGING",
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

	it("validates submission URLs correctly", () => {
		expect(validateSubmissionUrl("").isValid).toBe(false);
		expect(validateSubmissionUrl("not-a-url").isValid).toBe(false);
		expect(validateSubmissionUrl("ftp://example.com").isValid).toBe(false);
		expect(
			validateSubmissionUrl("https://github.com/astrea-payouts/astrea").isValid,
		).toBe(true);
		expect(validateSubmissionUrl("http://localhost:3000/demo").isValid).toBe(
			true,
		);
	});
});
