import type { EventStatus } from "@/generated/prisma/enums";

export type CancellationPath =
	| "PRE_LIVE_REFUND"
	| "POST_LIVE_DISPUTE"
	| "INELIGIBLE";

export type CancellationContext = {
	eventId: string;
	eventTitle: string;
	status: EventStatus;
	totalEscrowUsdc: number;
	currency: string;
	organizerAddress: string;
	adminWalletAddress: string;
	registeredParticipantsCount: number;
};

export type CancellationAuthResult = {
	isAuthorized: boolean;
	path: CancellationPath;
	reason?: string;
};

export type PreLiveCancelInput = {
	eventId: string;
	organizerWallet: string;
	cancellationReason?: string;
};

export type PreLiveCancelRecord = {
	eventId: string;
	outcome: "REFUNDED_TO_ADMIN_WALLET";
	refundAmountUsdc: number;
	adminWalletAddress: string;
	organizerWallet: string;
	txHash: string;
	cancelledAt: string;
};
