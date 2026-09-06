import type { DisputeEventContext } from "./types";

const DEMO_EVENTS: Record<string, DisputeEventContext> = {
	"meridian-2026": {
		id: "meridian-2026",
		title: "Meridian 2026 Community Hackathon",
		organizerAddress: "GBORGANIZER111111111111111111111111111111111111111111",
		judgeAddress: "GBJUDGE2222222222222222222222222222222222222222222222",
		resolverAddress: "GBRESOLVER33333333333333333333333333333333333333333333",
		participantAddresses: [
			"GBBUILDER444444444444444444444444444444444444444444444",
			"GBBUILDER555555555555555555555555555555555555555555555",
		],
		status: "JUDGING",
		prizes: [
			{
				id: "m1-architecture",
				title: "Architecture & Smart Contract Milestone",
				amountUsdc: 7500,
				status: "APPROVED",
			},
			{
				id: "m2-frontend",
				title: "Frontend & PWA Integration Milestone",
				amountUsdc: 10000,
				status: "ASSIGNED",
			},
			{
				id: "m3-security",
				title: "Security & Threat Modeling Milestone",
				amountUsdc: 7500,
				status: "PENDING",
			},
		],
	},
};

export async function getDisputeEventContext(
	id: string,
): Promise<DisputeEventContext | null> {
	if (DEMO_EVENTS[id]) {
		return DEMO_EVENTS[id];
	}

	return {
		id,
		title: `Stellar Event #${id}`,
		organizerAddress: "GBORGANIZER111111111111111111111111111111111111111111",
		judgeAddress: "GBJUDGE2222222222222222222222222222222222222222222222",
		resolverAddress: "GBRESOLVER33333333333333333333333333333333333333333333",
		participantAddresses: [
			"GBBUILDER444444444444444444444444444444444444444444444",
			"GBBUILDER555555555555555555555555555555555555555555555",
		],
		status: "LIVE",
		prizes: [
			{
				id: "milestone-1",
				title: "Core Deliverable Milestone",
				amountUsdc: 5000,
				status: "ASSIGNED",
			},
		],
	};
}
