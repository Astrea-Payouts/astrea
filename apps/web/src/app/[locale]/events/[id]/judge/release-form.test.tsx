// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";
import { ReleaseForm } from "./release-form";

const EVENT_ID = "20000000-0000-0000-0000-000000000001";
const JUDGE = "GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L";
const WINNER_1 = "GBXNBZ7Y3KQ2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2U27X";
const TX_HASH =
	"ee325b0624b2d29de14834a02b54ba5faf65c7e0b07b668c429715df6e3af994";

const { mockBuild, mockSubmit, mockSign } = vi.hoisted(() => ({
	mockBuild: vi.fn(),
	mockSubmit: vi.fn(),
	mockSign: vi.fn(),
}));

vi.mock("./actions", () => ({
	buildRelease: mockBuild,
	submitRelease: mockSubmit,
}));
vi.mock("@/lib/wallet/kit", () => ({
	StellarWalletsKit: { signTransaction: mockSign },
}));

const copy = messages.JudgePage;

const prizes = [
	{ rank: 1, amount: "0.2" },
	{ rank: 2, amount: "0.1" },
];
const teams = [
	{ id: "team-a", name: "Team Winner One" },
	{ id: "team-b", name: "Team Winner Two" },
];

const built = {
	ok: true as const,
	unsignedTransactionXdr: "AAAA",
	winners: [
		{ rank: 1, teamId: "team-a", teamMemberId: "m-a", address: WINNER_1 },
		{ rank: 2, teamId: "team-b", teamMemberId: "m-b", address: JUDGE },
	],
};

function renderForm() {
	return renderWithIntl(
		<ReleaseForm
			eventId={EVENT_ID}
			judgeAddress={JUDGE}
			prizes={prizes}
			teams={teams}
			symbol="USDC"
		/>,
	);
}

function rankSelect(rank: number) {
	return screen.getByRole("combobox", {
		name: new RegExp(`Prize #${rank}`),
	});
}

function assignAll() {
	fireEvent.change(rankSelect(1), { target: { value: "team-a" } });
	fireEvent.change(rankSelect(2), { target: { value: "team-b" } });
}

describe("ReleaseForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockBuild.mockResolvedValue(built);
		mockSign.mockResolvedValue({ signedTxXdr: "SIGNED" });
		mockSubmit.mockResolvedValue({
			ok: true,
			txHash: TX_HASH,
			status: "succeeded",
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("renders one select per prize rank, listing every team, with build disabled until all are assigned", () => {
		renderForm();

		const selects = screen.getAllByRole("combobox");
		expect(selects).toHaveLength(prizes.length);
		for (const select of selects) {
			const names = within(select)
				.getAllByRole("option")
				.map((o) => o.textContent);
			expect(names).toEqual([
				copy.pickTeam,
				"Team Winner One",
				"Team Winner Two",
			]);
		}
		expect(screen.getByText("0.2 USDC")).toBeInTheDocument();
		expect(screen.getByText("0.1 USDC")).toBeInTheDocument();

		const build = screen.getByRole("button", { name: copy.build });
		expect(build).toBeDisabled();
		fireEvent.change(rankSelect(1), { target: { value: "team-a" } });
		expect(build).toBeDisabled();
		fireEvent.change(rankSelect(2), { target: { value: "team-b" } });
		expect(build).toBeEnabled();
	});

	it("calls buildRelease with {rank, teamId} per rank and shows the winners Go returned", async () => {
		renderForm();
		assignAll();

		fireEvent.click(screen.getByRole("button", { name: copy.build }));

		await waitFor(() =>
			expect(mockBuild).toHaveBeenCalledWith(EVENT_ID, [
				{ rank: 1, teamId: "team-a" },
				{ rank: 2, teamId: "team-b" },
			]),
		);
		expect(await screen.findByText(copy.winnersTitle)).toBeInTheDocument();
		expect(screen.getByText("#1 · Team Winner One")).toBeInTheDocument();
		expect(screen.getByText("#2 · Team Winner Two")).toBeInTheDocument();
		expect(screen.getByText(WINNER_1)).toBeInTheDocument();
		// Assignments freeze once an envelope exists for them.
		expect(rankSelect(1)).toBeDisabled();
		expect(
			screen.queryByRole("button", { name: copy.build }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: copy.sign })).toBeEnabled();
	});

	it("renders a ReleaseFailure from build with status, code and message verbatim", async () => {
		mockBuild.mockResolvedValue({
			ok: false,
			status: 403,
			code: "not_judge",
			message: "wallet GDCY…MR5L is not the judge of this event",
		});
		renderForm();
		assignAll();

		fireEvent.click(screen.getByRole("button", { name: copy.build }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("403 not_judge");
		expect(alert).toHaveTextContent(
			"wallet GDCY…MR5L is not the judge of this event",
		);
		expect(screen.queryByText(copy.winnersTitle)).not.toBeInTheDocument();
		// Build stays available for another attempt; the transition's pending
		// flag can clear one commit after the failure renders.
		await waitFor(() =>
			expect(screen.getByRole("button", { name: copy.build })).toBeEnabled(),
		);
	});

	it("renders a missingTrustline refusal in the viewer's locale with the asset and every wallet", async () => {
		mockBuild.mockResolvedValue({
			ok: false,
			code: "missingTrustline",
			asset: "USDC:GISSUER",
			wallets: [WINNER_1, JUDGE],
		});
		renderForm();
		assignAll();

		fireEvent.click(screen.getByRole("button", { name: copy.build }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(copy.errors.missingTrustline);
		expect(within(alert).getByText("USDC:GISSUER")).toBeInTheDocument();
		const listed = within(alert)
			.getAllByRole("listitem")
			.map((li) => li.textContent);
		expect(listed).toEqual([WINNER_1, JUDGE]);
		expect(screen.queryByText(copy.winnersTitle)).not.toBeInTheDocument();
		await waitFor(() =>
			expect(screen.getByRole("button", { name: copy.build })).toBeEnabled(),
		);
	});

	it("omits the status prefix when the failure has none", async () => {
		mockBuild.mockResolvedValue({
			ok: false,
			status: 0,
			code: "unknown",
			message: "socket hang up",
		});
		renderForm();
		assignAll();

		fireEvent.click(screen.getByRole("button", { name: copy.build }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toBe("unknown — socket hang up");
	});

	it("signs, submits, and shows the released panel with the hash", async () => {
		renderForm();
		assignAll();
		fireEvent.click(screen.getByRole("button", { name: copy.build }));
		await screen.findByText(copy.winnersTitle);

		fireEvent.click(screen.getByRole("button", { name: copy.sign }));

		await waitFor(() =>
			expect(mockSubmit).toHaveBeenCalledWith(EVENT_ID, "SIGNED"),
		);
		expect(mockSign).toHaveBeenCalledWith("AAAA", {
			address: JUDGE,
			networkPassphrase: expect.any(String),
		});
		const panels = await screen.findAllByRole("status");
		const released = panels.find((p) => p.textContent?.includes(copy.released));
		expect(released).toBeDefined();
		expect(
			within(released as HTMLElement).getByRole("link", { name: /ee325b0624/ }),
		).toHaveAttribute("href", expect.stringContaining(TX_HASH));
		expect(
			screen.queryByRole("button", { name: copy.rebuild }),
		).not.toBeInTheDocument();
	});

	it("shows the pending copy for a 202 submit", async () => {
		mockSubmit.mockResolvedValue({
			ok: true,
			txHash: TX_HASH,
			status: "pending",
		});
		renderForm();
		assignAll();
		fireEvent.click(screen.getByRole("button", { name: copy.build }));
		await screen.findByText(copy.winnersTitle);

		fireEvent.click(screen.getByRole("button", { name: copy.sign }));

		await waitFor(() =>
			expect(screen.getByText(copy.pending)).toBeInTheDocument(),
		);
	});

	it("after a failed submit, the change-assignments control returns to the build state", async () => {
		mockSubmit.mockResolvedValue({
			ok: false,
			status: 409,
			code: "envelope_mismatch",
			message: "signed envelope does not match the built one",
		});
		renderForm();
		assignAll();
		fireEvent.click(screen.getByRole("button", { name: copy.build }));
		await screen.findByText(copy.winnersTitle);

		fireEvent.click(screen.getByRole("button", { name: copy.sign }));

		// Go's envelope is shown by the form; SignStep shows its own copy of
		// the same message. Both carry the code so either is enough to act on.
		const alerts = await screen.findAllByRole("alert");
		expect(
			alerts.some((a) => a.textContent?.includes("409 envelope_mismatch")),
		).toBe(true);
		expect(mockSubmit).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole("button", { name: copy.rebuild }));

		expect(screen.queryByText(copy.winnersTitle)).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: copy.build })).toBeEnabled();
		expect(rankSelect(1)).toBeEnabled();
		expect(rankSelect(1)).toHaveValue("team-a");
		expect(
			screen.queryByRole("button", { name: copy.sign }),
		).not.toBeInTheDocument();
	});

	it("keeps build disabled when the event has no teams", () => {
		renderWithIntl(
			<ReleaseForm
				eventId={EVENT_ID}
				judgeAddress={JUDGE}
				prizes={prizes}
				teams={[]}
				symbol="USDC"
			/>,
		);

		expect(screen.getByRole("button", { name: copy.build })).toBeDisabled();
	});
});
