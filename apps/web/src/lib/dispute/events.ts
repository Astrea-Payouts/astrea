import type { DisputeRecord } from "./types";

export const MOCK_DISPUTE_RECORD: DisputeRecord = {
	id: "disp_silent_judge_9981",
	eventId: "evt_soroban_hackathon",
	eventTitle: "Stellar Global Buildathon 2026",
	milestoneId: "m1_first_place",
	milestoneTitle: "1st Place Grand Prize",
	amountUsdc: "5,000",
	claimantAddress: "GAPARTICIPANT22222222222222222222222222222222222222222222",
	claimantRole: "PARTICIPANT",
	reason:
		"The official judging deadline expired 48 hours ago and the designated judge stopped responding without signing the release transaction.",
	evidenceUrl: "https://stellar.expert/explorer/testnet",
	status: "OPEN",
	createdAt: "2026-09-04T12:00:00Z",
	judgingDeadline: "2026-09-02T23:59:59Z",
	isJudgingDeadlinePassed: true,
	priorJudgeWinner: {
		wallet: "GAWINNER222222222222222222222222222222222222222222222222",
		participantName: "stellar-artisan",
		submissionUrl: "https://github.com/stellar-artisan/astrea-soroban-poc",
		notes:
			"Score: 98/100. Verification completed on-chain prior to judge timeout.",
		recordedAt: "2026-09-02T18:00:00Z",
	},
	resolverAddress: "GBRESOLVER7777777777777777777777777777777777777777777777",
};

/**
 * Fetches the dispute record for a given event and dispute ID.
 */
export async function getDisputeRecord(
	eventId: string,
	disputeId?: string,
): Promise<DisputeRecord> {
	// In production, this queries the Prisma/Core-Go database.
	return {
		...MOCK_DISPUTE_RECORD,
		eventId: eventId || MOCK_DISPUTE_RECORD.eventId,
		id: disputeId || MOCK_DISPUTE_RECORD.id,
	};
}
