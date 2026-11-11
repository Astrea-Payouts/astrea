import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	getPayoutRowState,
	PayoutHistory,
} from "./payout-history";

describe("getPayoutRowState — eligibility pure function (Issue #253 / U03b)", () => {
	it("returns 'confirmed' when a release transaction hash is present", () => {
		expect(
			getPayoutRowState({
				status: "RELEASED",
				releaseTxHash: "0941dbcdd6402436",
			})
		).toBe("confirmed");

		expect(
			getPayoutRowState({
				status: "PAID_OUT",
				releaseTxHash: "deadbeef12345678",
			})
		).toBe("confirmed");
	});

	it("returns 'pending' when prize status is released/paid but has no transaction hash", () => {
		expect(
			getPayoutRowState({
				status: "RELEASED",
				releaseTxHash: null,
			})
		).toBe("pending");

		expect(
			getPayoutRowState({
				status: "PAID_OUT",
				releaseTxHash: null,
			})
		).toBe("pending");
	});

	it("returns 'hidden' when prize is not released and has no transaction hash", () => {
		expect(
			getPayoutRowState({
				status: "PENDING",
				releaseTxHash: null,
			})
		).toBe("hidden");

		expect(
			getPayoutRowState({
				status: "LOCKED",
				releaseTxHash: null,
			})
		).toBe("hidden");

		expect(
			getPayoutRowState({
				status: undefined,
				releaseTxHash: null,
			})
		).toBe("hidden");
	});
});

describe("PayoutHistory component (Issue #253 / U03b)", () => {
	const mockLabels = {
		title: "Payout history",
		empty: "No payouts released yet.",
		formatRank: (rank: number) => `#${rank}`,
		unassignedWinner: "Pending winner",
		txProof: "Release tx",
		releasePending: "Release pending confirmation",
	};

	const teams = [
		{ id: "team-1", name: "Team Alpha" },
		{ id: "team-2", name: "Team Beta" },
	];

	it("renders both confirmed and pending rows with appropriate visual affordances", () => {
		const prizes = [
			{
				id: "p-1",
				rank: 1,
				amount: "1000",
				status: "RELEASED",
				winnerTeamId: "team-1",
				releaseTxHash: "0123456789abcdef",
			},
			{
				id: "p-2",
				rank: 2,
				amount: "500",
				status: "RELEASED",
				winnerTeamId: "team-2",
				releaseTxHash: null,
			},
			{
				id: "p-3",
				rank: 3,
				amount: "250",
				status: "LOCKED",
				winnerTeamId: null,
				releaseTxHash: null,
			},
		];

		render(
			<PayoutHistory
				prizes={prizes}
				teams={teams as any}
				assetSymbol="USDC"
				labels={mockLabels}
			/>
		);

		// Section header is present
		expect(screen.getByText("Payout history")).toBeInTheDocument();

		// Rank 1 (Confirmed): Has amount, winner, and Tx proof
		expect(screen.getByTestId("payout-history-row-1")).toBeInTheDocument();
		expect(screen.getByText("Team Alpha")).toBeInTheDocument();
		expect(screen.getByText("1000 USDC")).toBeInTheDocument();
		expect(screen.getByText("Release tx:")).toBeInTheDocument();

		// Rank 2 (Status-only): Has amount, winner, and honest pending confirmation badge
		expect(screen.getByTestId("payout-history-row-2")).toBeInTheDocument();
		expect(screen.getByText("Team Beta")).toBeInTheDocument();
		expect(screen.getByText("500 USDC")).toBeInTheDocument();
		expect(screen.getByTestId("payout-history-pending-2")).toHaveTextContent(
			"Release pending confirmation"
		);

		// Rank 3 (Non-released): Excluded from payout history
		expect(screen.queryByTestId("payout-history-row-3")).not.toBeInTheDocument();
	});

	it("renders null when no prizes are released or confirmed", () => {
		const nonReleasedPrizes = [
			{
				id: "p-1",
				rank: 1,
				amount: "1000",
				status: "LOCKED",
				winnerTeamId: null,
				releaseTxHash: null,
			},
		];

		const { container } = render(
			<PayoutHistory
				prizes={nonReleasedPrizes}
				teams={teams as any}
				assetSymbol="USDC"
				labels={mockLabels}
			/>
		);

		expect(container.firstChild).toBeNull();
	});
});
