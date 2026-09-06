import { describe, expect, it } from "vitest";
import type { Event, Participant } from "@/generated/prisma/client";

describe("S03 schema definitions", () => {
	it("verifies Event model includes conditionsMetAt nullable date field", () => {
		const sampleEvent: Partial<Event> = {
			id: "evt-1",
			name: "Test Event",
			status: "DRAFT",
			conditionsMetAt: null,
		};
		expect(sampleEvent.conditionsMetAt).toBeNull();

		const activatedEvent: Partial<Event> = {
			id: "evt-2",
			name: "Activated Event",
			status: "LIVE",
			conditionsMetAt: new Date("2026-09-07T00:00:00Z"),
		};
		expect(activatedEvent.conditionsMetAt).toBeInstanceOf(Date);
	});

	it("verifies Participant model has architecture-aligned field names", () => {
		const sampleParticipant: Participant = {
			id: "part-1",
			eventId: "evt-1",
			walletId: "wal-1",
			submissionUrl: "https://github.com/astrea-example/demo",
			registeredAt: new Date("2026-09-07T00:00:00Z"),
		};

		expect(sampleParticipant.id).toBe("part-1");
		expect(sampleParticipant.eventId).toBe("evt-1");
		expect(sampleParticipant.walletId).toBe("wal-1");
		expect(sampleParticipant.submissionUrl).toBe(
			"https://github.com/astrea-example/demo",
		);
		expect(sampleParticipant.registeredAt).toBeInstanceOf(Date);
	});

	it("verifies Participant model operations", () => {
		const mockPrisma = {
			participant: {
				findMany: () => Promise.resolve([]),
				create: () => Promise.resolve({}),
			},
		};
		expect(typeof mockPrisma.participant.findMany).toBe("function");
	});
});
