import { describe, expect, it } from "vitest";
import {
	calculateFundingProgress,
	canPublishEvent,
	getEmergencyWithdrawDisplay,
	getEventStatusBadge,
	isPreLiveExitAllowed,
} from "../organizer-helpers";
import type { EmergencyWithdrawState, EventStatus } from "../types";

describe("Organizer helpers (U02)", () => {
	describe("canPublishEvent", () => {
		it("allows publishing only when conditionsMetAt is present and status is pre-LIVE", () => {
			expect(
				canPublishEvent({
					status: "FUNDED",
					conditionsMetAt: "2026-09-06T12:00:00Z",
				}),
			).toBe(true);

			expect(
				canPublishEvent({
					status: "CONDITIONS_MET",
					conditionsMetAt: "2026-09-06T12:00:00Z",
				}),
			).toBe(true);

			expect(
				canPublishEvent({
					status: "CREATED",
					conditionsMetAt: "2026-09-06T12:00:00Z",
				}),
			).toBe(true);
		});

		it("blocks publishing when conditionsMetAt is null/empty even if status is FUNDED", () => {
			expect(
				canPublishEvent({
					status: "FUNDED",
					conditionsMetAt: null,
				}),
			).toBe(false);

			expect(
				canPublishEvent({
					status: "CREATED",
					conditionsMetAt: undefined,
				}),
			).toBe(false);
		});

		it("blocks publishing if event is already LIVE or beyond, regardless of conditionsMetAt", () => {
			expect(
				canPublishEvent({
					status: "LIVE",
					conditionsMetAt: "2026-09-06T12:00:00Z",
				}),
			).toBe(false);

			expect(
				canPublishEvent({
					status: "JUDGING",
					conditionsMetAt: "2026-09-06T12:00:00Z",
				}),
			).toBe(false);

			expect(
				canPublishEvent({
					status: "COMPLETED",
					conditionsMetAt: "2026-09-06T12:00:00Z",
				}),
			).toBe(false);

			expect(
				canPublishEvent({
					status: "CANCELLED",
					conditionsMetAt: "2026-09-06T12:00:00Z",
				}),
			).toBe(false);

			expect(
				canPublishEvent({
					status: "DISPUTED",
					conditionsMetAt: "2026-09-06T12:00:00Z",
				}),
			).toBe(false);
		});
	});

	describe("isPreLiveExitAllowed", () => {
		it("permits exit actions only in pre-LIVE states", () => {
			const preLive: EventStatus[] = [
				"DRAFT",
				"CREATED",
				"STANDBY",
				"FUNDED",
				"CONDITIONS_MET",
			];
			for (const st of preLive) {
				expect(isPreLiveExitAllowed(st)).toBe(true);
			}
		});

		it("disables exit actions once event reaches LIVE or terminal states", () => {
			const postLive: EventStatus[] = [
				"LIVE",
				"JUDGING",
				"COMPLETED",
				"DISPUTED",
				"CANCELLED",
			];
			for (const st of postLive) {
				expect(isPreLiveExitAllowed(st)).toBe(false);
			}
		});
	});

	describe("getEmergencyWithdrawDisplay (ADR-006 2-signature enforcement)", () => {
		it("shows pending resolver co-signature when organizer has signed but resolver has not", () => {
			const state: EmergencyWithdrawState = {
				status: "PENDING_RESOLVER_SIGNATURE",
				organizerSigned: true,
				resolverCoSigned: false,
			};
			const display = getEmergencyWithdrawDisplay(state, "FUNDED");
			expect(display.isPendingResolver).toBe(true);
			expect(display.isCompleted).toBe(false);
			expect(display.badgeVariant).toBe("warning");
			expect(display.labelKey).toBe("emergencyPendingResolver");
		});

		it("shows completed only after both organizer and resolver have signed", () => {
			const state: EmergencyWithdrawState = {
				status: "CO_SIGNED_RELEASED",
				organizerSigned: true,
				resolverCoSigned: true,
			};
			const display = getEmergencyWithdrawDisplay(state, "FUNDED");
			expect(display.isPendingResolver).toBe(false);
			expect(display.isCompleted).toBe(true);
			expect(display.badgeVariant).toBe("success");
			expect(display.labelKey).toBe("emergencyCoSignedReleased");
		});

		it("disables request action if event is LIVE, even if unrequested", () => {
			const state: EmergencyWithdrawState = {
				status: "NONE",
				organizerSigned: false,
				resolverCoSigned: false,
			};
			const display = getEmergencyWithdrawDisplay(state, "LIVE");
			expect(display.canRequest).toBe(false);
		});

		it("enables request action if event is pre-LIVE and not yet requested", () => {
			const state: EmergencyWithdrawState = {
				status: "NONE",
				organizerSigned: false,
				resolverCoSigned: false,
			};
			const display = getEmergencyWithdrawDisplay(state, "CREATED");
			expect(display.canRequest).toBe(true);
		});
	});

	describe("getEventStatusBadge", () => {
		it("accurately handles all status states including side states", () => {
			const created = getEventStatusBadge("CREATED");
			expect(created.isLive).toBe(false);
			expect(created.isDisputed).toBe(false);

			const live = getEventStatusBadge("LIVE");
			expect(live.isLive).toBe(true);
			expect(live.isDisputed).toBe(false);

			const disputed = getEventStatusBadge("DISPUTED");
			expect(disputed.isDisputed).toBe(true);
			expect(disputed.isLive).toBe(false);

			const cancelled = getEventStatusBadge("CANCELLED");
			expect(cancelled.isCancelled).toBe(true);
			expect(cancelled.isLive).toBe(false);
		});
	});

	describe("calculateFundingProgress", () => {
		it("calculates non-optimistic funding math correctly", () => {
			const partial = calculateFundingProgress(2500, 5000);
			expect(partial.percentage).toBe(50);
			expect(partial.isFullyFunded).toBe(false);
			expect(partial.remaining).toBe(2500);

			const complete = calculateFundingProgress(5000, 5000);
			expect(complete.percentage).toBe(100);
			expect(complete.isFullyFunded).toBe(true);
			expect(complete.remaining).toBe(0);

			const overfunded = calculateFundingProgress(6000, 5000);
			expect(overfunded.percentage).toBe(100);
			expect(overfunded.isFullyFunded).toBe(true);
			expect(overfunded.remaining).toBe(0);
		});
	});
});
