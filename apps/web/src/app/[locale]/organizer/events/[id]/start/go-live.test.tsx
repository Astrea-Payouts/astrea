// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SignStepProps } from "@/components/events/sign-step";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const OP_ID = "0123456789abcdef0123456789abcdef";
const HASH = "0941dbcdd6958dae1c9606f225d7a8c4e8dc1a7ec9c5595eecb1a8a633e13bc5";
const DEADLINE = "Dec 31, 2026, 11:59 PM";
const FEE = "5000000"; // 0.5 USDC

const {
	mockReadQuote,
	mockBuildStart,
	mockSubmitStart,
	mockBuildDeposit,
	mockSubmitDeposit,
	mockReadEventStatus,
	mockPush,
} = vi.hoisted(() => ({
	mockReadQuote: vi.fn(),
	mockBuildStart: vi.fn(),
	mockSubmitStart: vi.fn(),
	mockBuildDeposit: vi.fn(),
	mockSubmitDeposit: vi.fn(),
	mockReadEventStatus: vi.fn(),
	mockPush: vi.fn(),
}));

vi.mock("./actions", () => ({
	readQuote: mockReadQuote,
	buildStart: mockBuildStart,
	submitStart: mockSubmitStart,
}));
// The deposit step and the status read are shared with /fund (../actions).
vi.mock("../actions", () => ({
	buildDeposit: mockBuildDeposit,
	submitDeposit: mockSubmitDeposit,
	readEventStatus: mockReadEventStatus,
}));
vi.mock("@/i18n/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));
// The real SignStep opens the wallet; this stub hands a fixed envelope to
// onSigned and mirrors its confirmed / failed rendering.
vi.mock("@/components/events/sign-step", () => ({
	SignStep: ({ unsignedXdr, onSigned, label }: SignStepProps) => (
		<button
			type="button"
			data-xdr={unsignedXdr}
			onClick={() => {
				onSigned("SIGNED").catch(() => {});
			}}
		>
			{label ?? "sign"}
		</button>
	),
}));

const { GoLive } = await import("./go-live");

const covered = { fee: FEE, balance: "8000000", shortfall: "0" };
const short = { fee: FEE, balance: "2000000", shortfall: "3000000" };

function render(quote: typeof covered, deadline: string | null = DEADLINE) {
	return renderWithIntl(
		<GoLive
			eventId={EVENT_ID}
			address={ADDRESS}
			initialQuote={quote}
			judgingDeadline={deadline}
			timezone="America/Costa_Rica"
			symbol="USDC"
		/>,
	);
}

const page = messages.GoLivePage;
const deposit = messages.DepositStep;

function goLiveButton() {
	return screen.getByRole("button", { name: page.start.build });
}

describe("GoLive — quote covers the fee", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockBuildStart.mockResolvedValue({
			ok: true,
			unsignedTransactionXdr: "START-XDR",
			judgingDeadline: 1798761540,
			fee: FEE,
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("shows fee, balance, shortfall and deadline, skips the deposit step, builds only on click", () => {
		render(covered);

		expect(screen.getByTestId("fee")).toHaveTextContent("0.5 USDC");
		expect(screen.getByTestId("balance")).toHaveTextContent("0.8 USDC");
		expect(screen.getByTestId("shortfall")).toHaveTextContent("0 USDC");
		expect(screen.getByText(DEADLINE)).toBeInTheDocument();
		expect(screen.getByText(page.feeHint)).toBeInTheDocument();
		expect(screen.queryByText(deposit.title)).not.toBeInTheDocument();
		expect(goLiveButton()).toBeEnabled();
		expect(mockBuildStart).not.toHaveBeenCalled();
	});

	it("builds right before signing, submits, and redirects once the status reads LIVE", async () => {
		mockSubmitStart.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "succeeded",
		});
		mockReadEventStatus.mockResolvedValue({
			ok: true,
			status: "LIVE",
			escrowEventId: "x",
		});
		render(covered);

		fireEvent.click(goLiveButton());

		const sign = await screen.findByRole("button", { name: page.start.sign });
		expect(mockBuildStart).toHaveBeenCalledWith(EVENT_ID);
		expect(sign).toHaveAttribute("data-xdr", "START-XDR");
		expect(screen.getByTestId("built-fee")).toHaveTextContent("0.5 USDC");
		// Go's unix seconds (2026-12-31T23:59:00Z), shown like the quote above:
		// same style, event timezone (UTC-6).
		expect(screen.getByTestId("built-deadline")).toHaveTextContent(
			/Dec 31, 2026.*5:59/,
		);

		fireEvent.click(sign);

		await waitFor(() =>
			expect(mockSubmitStart).toHaveBeenCalledWith(EVENT_ID, "SIGNED"),
		);
		await waitFor(() => expect(mockReadEventStatus).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith(`/events/${EVENT_ID}`),
		);
	});

	it("on a 200 whose status still reads CREATED, keeps the hash and redirects only after check-again reads LIVE", async () => {
		mockSubmitStart.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "succeeded",
		});
		mockReadEventStatus
			.mockResolvedValueOnce({
				ok: true,
				status: "CREATED",
				escrowEventId: "x",
			})
			.mockResolvedValueOnce({ ok: true, status: "LIVE", escrowEventId: "x" });
		render(covered);

		fireEvent.click(goLiveButton());
		fireEvent.click(
			await screen.findByRole("button", { name: page.start.sign }),
		);

		const status = await screen.findByRole("status");
		expect(status).toHaveTextContent(page.start.confirmed);
		expect(screen.getByRole("link", { name: /0941dbcdd6/ })).toHaveAttribute(
			"href",
			expect.stringContaining(HASH),
		);
		expect(mockPush).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: page.checkAgain }));
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith(`/events/${EVENT_ID}`),
		);
	});

	it("stays on a 202 with the hash and redirects only once check-again reads LIVE", async () => {
		mockSubmitStart.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "pending",
		});
		mockReadEventStatus
			.mockResolvedValueOnce({
				ok: true,
				status: "CREATED",
				escrowEventId: "x",
			})
			.mockResolvedValueOnce({ ok: true, status: "LIVE", escrowEventId: "x" });
		render(covered);

		fireEvent.click(goLiveButton());
		fireEvent.click(
			await screen.findByRole("button", { name: page.start.sign }),
		);

		const status = await screen.findByRole("status");
		expect(status).toHaveTextContent(page.start.pending);
		expect(
			screen.getByRole("link", { name: /0941dbcdd6/ }),
		).toBeInTheDocument();
		// A 202 reads nothing on its own; the organizer clicks.
		expect(mockReadEventStatus).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: page.checkAgain }));
		await waitFor(() => expect(mockReadEventStatus).toHaveBeenCalledTimes(1));
		expect(mockPush).not.toHaveBeenCalled();

		fireEvent.click(
			await screen.findByRole("button", { name: page.checkAgain }),
		);
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith(`/events/${EVENT_ID}`),
		);
	});

	it("re-quotes and falls back to the deposit step on insufficient_balance", async () => {
		mockBuildStart.mockResolvedValue({
			ok: false,
			status: 409,
			code: "insufficient_balance",
			message: "fee 5000000, balance 2000000, shortfall 3000000",
		});
		mockReadQuote.mockResolvedValue({ ok: true, ...short });
		render(covered);

		fireEvent.click(goLiveButton());

		await screen.findByText(deposit.title);
		expect(mockReadQuote).toHaveBeenCalledWith(EVENT_ID);
		expect(screen.getByTestId("shortfall")).toHaveTextContent("0.3 USDC");
		expect(
			screen.getByRole("textbox", { name: /Amount to deposit/ }),
		).toHaveValue("0.3");
		expect(
			screen.queryByRole("button", { name: page.start.build }),
		).not.toBeInTheDocument();
	});

	it.each(["event_not_created", "start_already_succeeded"])(
		"re-reads the status on %s and redirects when it is LIVE",
		async (code) => {
			mockBuildStart.mockResolvedValue({
				ok: false,
				status: 409,
				code,
				message: "already live",
			});
			mockReadEventStatus.mockResolvedValue({
				ok: true,
				status: "LIVE",
				escrowEventId: "x",
			});
			render(covered);

			fireEvent.click(goLiveButton());

			await waitFor(() =>
				expect(mockPush).toHaveBeenCalledWith(`/events/${EVENT_ID}`),
			);
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		},
	);

	it("shows event_not_created verbatim when the status is not LIVE", async () => {
		mockBuildStart.mockResolvedValue({
			ok: false,
			status: 409,
			code: "event_not_created",
			message: "event is CANCELLED",
		});
		mockReadEventStatus.mockResolvedValue({
			ok: true,
			status: "CANCELLED",
			escrowEventId: "x",
		});
		render(covered);

		fireEvent.click(goLiveButton());

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("409 event_not_created");
		expect(alert).toHaveTextContent("event is CANCELLED");
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("drops the build and offers Go live again on no_pending_start", async () => {
		mockSubmitStart.mockResolvedValue({
			ok: false,
			status: 409,
			code: "no_pending_start",
			message: "build first",
		});
		render(covered);

		fireEvent.click(goLiveButton());
		fireEvent.click(
			await screen.findByRole("button", { name: page.start.sign }),
		);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("409 no_pending_start");
		expect(
			screen.queryByRole("button", { name: page.start.sign }),
		).not.toBeInTheDocument();
		expect(goLiveButton()).toBeEnabled();
	});

	it("uses the dedicated copy with the hash on start_build_replaced, then offers Go live again", async () => {
		mockSubmitStart.mockResolvedValue({
			ok: false,
			status: 409,
			code: "start_build_replaced",
			message: "replaced",
			txHash: HASH,
		});
		render(covered);

		fireEvent.click(goLiveButton());
		fireEvent.click(
			await screen.findByRole("button", { name: page.start.sign }),
		);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("replaced meanwhile");
		expect(alert).toHaveTextContent(HASH);
		expect(goLiveButton()).toBeEnabled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it.each([
		["deadline_missing", page.start.deadlineMissing],
		["deadline_past", "has already passed"],
	])(
		"on %s explains with the stored deadline and removes the button",
		async (code, copy) => {
			mockBuildStart.mockResolvedValue({
				ok: false,
				status: 409,
				code,
				message: "deadline problem",
			});
			render(covered);

			fireEvent.click(goLiveButton());

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent(copy);
			expect(alert).toHaveTextContent("out of scope");
			expect(
				screen.queryByRole("button", { name: page.start.build }),
			).not.toBeInTheDocument();
		},
	);

	it("renders any other code and message verbatim", async () => {
		mockBuildStart.mockResolvedValue({
			ok: false,
			status: 502,
			code: "simulation_failed",
			message: "host trap",
		});
		render(covered);

		fireEvent.click(goLiveButton());

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("502 simulation_failed");
		expect(alert).toHaveTextContent("host trap");
		expect(goLiveButton()).toBeEnabled();
	});

	it("lets the organizer discard a build and start over", async () => {
		render(covered);

		fireEvent.click(goLiveButton());
		await screen.findByRole("button", { name: page.start.sign });

		fireEvent.click(screen.getByRole("button", { name: page.start.discard }));

		expect(
			screen.queryByRole("button", { name: page.start.sign }),
		).not.toBeInTheDocument();
		expect(goLiveButton()).toBeEnabled();
	});
});

describe("GoLive — quote is short", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockBuildDeposit.mockResolvedValue({
			ok: true,
			opId: OP_ID,
			unsignedTransactionXdr: "DEPOSIT-XDR",
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("shows the deposit step prefilled with the shortfall and hides Go live", () => {
		render(short);

		expect(screen.getByText(deposit.title)).toBeInTheDocument();
		expect(
			screen.getByRole("textbox", { name: /Amount to deposit/ }),
		).toHaveValue("0.3");
		expect(
			screen.queryByRole("button", { name: page.start.build }),
		).not.toBeInTheDocument();
	});

	it("re-quotes after a confirmed deposit and advances to Go live once covered", async () => {
		mockSubmitDeposit.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "succeeded",
		});
		mockReadQuote.mockResolvedValue({ ok: true, ...covered });
		render(short);

		fireEvent.click(screen.getByRole("button", { name: "Deposit 0.3 USDC" }));
		fireEvent.click(await screen.findByRole("button", { name: deposit.sign }));

		await waitFor(() =>
			expect(mockSubmitDeposit).toHaveBeenCalledWith(ADDRESS, OP_ID, "SIGNED"),
		);
		await waitFor(() => expect(mockReadQuote).toHaveBeenCalledWith(EVENT_ID));
		await screen.findByRole("button", { name: page.start.build });
		expect(screen.getByTestId("balance")).toHaveTextContent("0.8 USDC");
		expect(screen.queryByText(deposit.title)).not.toBeInTheDocument();
	});

	it("on a 202 re-quotes on check-again and stays until the quote is covered", async () => {
		mockSubmitDeposit.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "pending",
		});
		mockReadQuote
			.mockResolvedValueOnce({ ok: true, ...short })
			.mockResolvedValueOnce({ ok: true, ...covered });
		render(short);

		fireEvent.click(screen.getByRole("button", { name: "Deposit 0.3 USDC" }));
		fireEvent.click(await screen.findByRole("button", { name: deposit.sign }));

		await screen.findByRole("status");
		fireEvent.click(screen.getByRole("button", { name: deposit.checkAgain }));
		await waitFor(() => expect(mockReadQuote).toHaveBeenCalledTimes(1));
		expect(
			screen.queryByRole("button", { name: page.start.build }),
		).not.toBeInTheDocument();

		fireEvent.click(
			await screen.findByRole("button", { name: deposit.checkAgain }),
		);
		await screen.findByRole("button", { name: page.start.build });
	});

	it("shows a failed re-quote under the deposit step", async () => {
		mockSubmitDeposit.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "succeeded",
		});
		mockReadQuote.mockResolvedValue({
			ok: false,
			status: 502,
			code: "transport",
			message: "upstream down",
		});
		render(short);

		fireEvent.click(screen.getByRole("button", { name: "Deposit 0.3 USDC" }));
		fireEvent.click(await screen.findByRole("button", { name: deposit.sign }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("502 transport");
		expect(screen.getByText(deposit.title)).toBeInTheDocument();
	});
});
