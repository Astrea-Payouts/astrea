/**
 * Participant Flow Types (U04)
 * Architecture reference: docs/product-flows.md Flow 3, ADR-004
 */

export type RegistrationWindowStatus = "OPEN" | "CLOSED" | "UPCOMING";

export type ParticipantRegistrationState =
	| "IDLE"
	| "REGISTERING"
	| "REGISTERED"
	| "ALREADY_REGISTERED"
	| "REGISTRATION_CLOSED"
	| "ERROR";

export type UsdcTrustlineState =
	| "IDLE"
	| "CHECKING"
	| "ACTIVE"
	| "MISSING"
	| "ERROR";

export interface ParticipantAnswer {
	questionId: string;
	questionLabel: string;
	value: string | boolean;
}

export interface ParticipantRegistration {
	eventId: string;
	walletAddress: string;
	registeredAt: Date | string;
	answers?: ParticipantAnswer[];
}

export interface ParticipantSubmission {
	id?: string;
	eventId: string;
	walletAddress: string;
	url: string;
	submittedAt: Date | string;
	notes?: string;
}

export type EventParticipantStep =
	| "CONNECT_WALLET"
	| "REGISTER"
	| "TRUSTLINE_CHECK"
	| "SUBMIT_PROJECT"
	| "UNDER_REVIEW"
	| "COMPLETED";

export interface ParticipantProgressInfo {
	isWalletConnected: boolean;
	isRegistered: boolean;
	hasTrustline: boolean;
	submission?: ParticipantSubmission | null;
	eventStatus:
		| "CREATED"
		| "FUNDED"
		| "LIVE"
		| "JUDGING"
		| "COMPLETED"
		| "CANCELLED";
	canSubmit: boolean;
}
