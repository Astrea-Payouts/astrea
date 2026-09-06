export type EventStatus =
	| "DRAFT"
	| "CREATED"
	| "STANDBY"
	| "FUNDED"
	| "CONDITIONS_MET"
	| "LIVE"
	| "JUDGING"
	| "COMPLETED"
	| "DISPUTED"
	| "CANCELLED";

export interface FundingDetails {
	targetAmount: number;
	currentBalance: number;
	currency: string;
	contractId: string;
	isFunded: boolean;
	depositAddress: string;
	requiredMinParticipants: number;
	registeredParticipantsCount: number;
}

export type EmergencyWithdrawStatus =
	| "NONE"
	| "PENDING_RESOLVER_SIGNATURE"
	| "CO_SIGNED_RELEASED"
	| "REJECTED";

export interface EmergencyWithdrawState {
	status: EmergencyWithdrawStatus;
	organizerSigned: boolean;
	resolverCoSigned: boolean;
	requestedAt?: string;
	resolverAddress?: string;
	reason?: string;
}

export interface OrganizerParticipant {
	id: string;
	name: string;
	walletAddress: string;
	registeredAt: string;
	hasTrustline: boolean;
	answers?: Record<string, string>;
}

export interface OrganizerEvent {
	id: string;
	title: string;
	description: string;
	organizerAddress: string;
	status: EventStatus;
	conditionsMetAt?: string | null;
	publishedAt?: string | null;
	funding: FundingDetails;
	emergencyWithdraw: EmergencyWithdrawState;
	participants: OrganizerParticipant[];
	createdAt: string;
	updatedAt: string;
}

export interface PublishEventResult {
	success: boolean;
	event?: OrganizerEvent;
	error?: string;
}

export interface CancelEventResult {
	success: boolean;
	refundTxHash?: string;
	error?: string;
}

export interface EmergencyWithdrawRequestResult {
	success: boolean;
	status: EmergencyWithdrawStatus;
	error?: string;
}
