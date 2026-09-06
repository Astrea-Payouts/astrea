import { env } from "@/lib/env";
import type { EventParticipantStep, UsdcTrustlineState } from "./types";

export function truncateStellarKey(key: string, head = 6, tail = 6): string {
	if (!key || key.length <= head + tail) return key;
	return `${key.slice(0, head)}…${key.slice(-tail)}`;
}

export function buildStellarLabTrustlineUrl(
	publicKey: string,
	network: "testnet" | "mainnet" = "testnet",
): string {
	const issuer = env.USDC_ISSUER;
	const assetCode = env.USDC_SYMBOL;
	return `https://laboratory.stellar.org/#txbuilder?params=&network=${network}&source=${publicKey}&asset_code=${assetCode}&asset_issuer=${issuer}`;
}

export function calculateParticipantStep(info: {
	isWalletConnected: boolean;
	isRegistered: boolean;
	trustlineStatus: UsdcTrustlineState;
	hasSubmission: boolean;
	eventStatus: string;
}): EventParticipantStep {
	if (!info.isWalletConnected) return "CONNECT_WALLET";
	if (!info.isRegistered) return "REGISTER";
	if (info.trustlineStatus !== "ACTIVE") return "TRUSTLINE_CHECK";
	if (!info.hasSubmission) return "SUBMIT_PROJECT";
	if (info.eventStatus === "JUDGING") return "UNDER_REVIEW";
	return "COMPLETED";
}

export function canSubmitProject(info: {
	isRegistered: boolean;
	trustlineStatus: UsdcTrustlineState;
	eventStatus: string;
}): boolean {
	if (!info.isRegistered) return false;
	if (info.trustlineStatus !== "ACTIVE") return false;
	return info.eventStatus === "LIVE";
}

export function validateSubmissionUrl(rawUrl: string): {
	isValid: boolean;
	error?: string;
} {
	if (!rawUrl || rawUrl.trim().length === 0) {
		return { isValid: false, error: "Submission URL is required" };
	}
	try {
		const parsed = new URL(rawUrl.trim());
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return {
				isValid: false,
				error: "Submission must be a valid HTTP or HTTPS URL",
			};
		}
		return { isValid: true };
	} catch {
		return { isValid: false, error: "Invalid URL format" };
	}
}
