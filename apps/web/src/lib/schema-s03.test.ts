import { describe, expect, it } from "vitest";
import type { Event } from "@/generated/prisma/client";

// The two Participant-shape tests this file used to carry are gone along
// with the model itself — see 20260910080000_replace_participants_with_teams
// (Participant is replaced by Team/TeamMember; a solo entrant is a team of
// one). The Event.conditionsMetAt test is untouched by that change.
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
});
