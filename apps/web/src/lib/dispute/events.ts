import type { CancelDisputeRecord } from "./types";

export const MOCK_CANCEL_DISPUTE: CancelDisputeRecord = {
	id: "disp_cancel_8812",
	eventId: "evt_soroban_defi",
	eventTitle: "Soroban DeFi Frontier Hackathon",
	totalEscrowUsdc: 10000,
	currency: "USDC",
	organizerAddress: "GDORGANIZER2222222222222222222222222222222222222222222222",
	resolverAddress: "GBRESOLVER7777777777777777777777777777777777777777777777",
	registeredParticipantsCount: 24,
	cancellationReason:
		"Sponsor restructuring and unexpected pivot in foundation grant mandates after event launch.",
	requestedAt: "2026-09-04T10:00:00Z",
	status: "OPEN",
};

export async function getCancelDisputeRecord(
	eventId: string,
	disputeId?: string,
): Promise<CancelDisputeRecord> {
	return {
		...MOCK_CANCEL_DISPUTE,
		eventId: eventId || MOCK_CANCEL_DISPUTE.eventId,
		id: disputeId || MOCK_CANCEL_DISPUTE.id,
	};
}
