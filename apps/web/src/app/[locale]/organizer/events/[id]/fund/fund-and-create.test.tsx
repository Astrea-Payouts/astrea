// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SignStepProps } from "@/components/events/sign-step";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const ESCROW_ID = "58e01828eeeba7090fc21c878f8d28da";
const OP_ID = "0123456789abcdef0123456789abcdef";
const HASH = "0941dbcdd6958dae1c9606f225d7a8c4e8dc1a7ec9c5595eecb1a8a633e13bc5";
const REQUIRED = "25000000"; // 2.5 USDC

const {
	mockReadBalance,
	mockBuildDeposit,
	mockSubmitDeposit,
	mockBuildCreate,
	mockSubmitCreate,
	mockReadEventStatus,
	mockPush,
} = vi.hoisted(() => ({
	mockReadBalance: vi.fn(),
	mockBuildDeposit: vi.fn(),
	mockSubmitDeposit: vi.fn(),
	mockBuildCreate: vi.fn(),
	mockSubmitCreate: vi.fn(),
	mockReadEventStatus: vi.fn(),
	mockPush: vi.fn(),
}));

vi.mock("./actions", () => ({
	readBalance: mockReadBalance,
	buildDeposit: mockBuildDeposit,
	submitDeposit: mockSubmitDeposit,
	buildCreate: mockBuildCreate,
	submitCreate: mockSubmitCreate,
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

const { FundAndCreate } = await import("./fund-and-create");

function render(initialBalance: string) {
	return renderWithIntl(
		<FundAndCreate
			eventId={EVENT_ID}
			address={ADDRESS}
			initialBalance={initialBalance}
			required={REQUIRED}
			symbol="USDC"
		/>,
	);
}

const fund = messages.FundPage;

describe("FundAndCreate — step 2 (balance covers the prizes)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockBuildCreate.mockResolvedValue({
			ok: true,
			unsignedTransactionXdr: "CREATE-XDR",
			reward: REQUIRED,
			escrowEventId: ESCROW_ID,
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("shows balance and required, skips the deposit step, and builds only on click", () => {
		render("30000000");

		expect(screen.getByTestId("balance")).toHaveTextContent("3 USDC");
		expect(screen.getByText("2.5 USDC")).toBeInTheDocument();
		expect(screen.queryByText(fund.deposit.title)).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", {
				name: "Reserve 2.5 USDC and create the event",
			}),
		).toBeEnabled();
		expect(mockBuildCreate).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", { name: fund.create.sign }),
		).not.toBeInTheDocument();
	});

	it("builds, shows Go's reward and escrow id, signs, submits and redirects on 200", async () => {
		mockSubmitCreate.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "succeeded",
			escrowEventId: ESCROW_ID,
		});
		render(REQUIRED);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Reserve 2.5 USDC and create the event",
			}),
		);

		const sign = await screen.findByRole("button", { name: fund.create.sign });
		expect(mockBuildCreate).toHaveBeenCalledWith(EVENT_ID);
		expect(sign).toHaveAttribute("data-xdr", "CREATE-XDR");
		expect(screen.getByTestId("reward")).toHaveTextContent("2.5 USDC");
		expect(screen.getByText(ESCROW_ID)).toBeInTheDocument();

		fireEvent.click(sign);

		await waitFor(() =>
			expect(mockSubmitCreate).toHaveBeenCalledWith(EVENT_ID, "SIGNED"),
		);
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith(`/events/${EVENT_ID}`),
		);
	});

	it("refuses to sign when Go's reward differs from the page's sum, showing both numbers", async () => {
		mockBuildCreate.mockResolvedValue({
			ok: true,
			unsignedTransactionXdr: "CREATE-XDR",
			reward: "25000001",
			escrowEventId: ESCROW_ID,
		});
		render(REQUIRED);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Reserve 2.5 USDC and create the event",
			}),
		);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("2.5000001 USDC");
		expect(alert).toHaveTextContent("2.5 USDC");
		expect(
			screen.queryByRole("button", { name: fund.create.sign }),
		).not.toBeInTheDocument();
		expect(mockSubmitCreate).not.toHaveBeenCalled();
	});

	it("stays on a 202 with the hash and redirects only once check-again reads CREATED", async () => {
		mockSubmitCreate.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "pending",
			escrowEventId: ESCROW_ID,
		});
		mockReadEventStatus
			.mockResolvedValueOnce({ ok: true, status: "DRAFT", escrowEventId: null })
			.mockResolvedValueOnce({
				ok: true,
				status: "CREATED",
				escrowEventId: ESCROW_ID,
			});
		render(REQUIRED);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Reserve 2.5 USDC and create the event",
			}),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: fund.create.sign }),
		);

		const status = await screen.findByRole("status");
		expect(status).toHaveTextContent(fund.create.pending);
		expect(screen.getByRole("link", { name: /0941dbcdd6/ })).toHaveAttribute(
			"href",
			expect.stringContaining(HASH),
		);
		expect(mockPush).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: fund.checkAgain }));
		await waitFor(() => expect(mockReadEventStatus).toHaveBeenCalledTimes(1));
		expect(mockPush).not.toHaveBeenCalled();

		fireEvent.click(
			await screen.findByRole("button", { name: fund.checkAgain }),
		);
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith(`/events/${EVENT_ID}`),
		);
	});

	it("renders Go's code and message verbatim when the build is refused", async () => {
		mockBuildCreate.mockResolvedValue({
			ok: false,
			status: 409,
			code: "no_prizes",
			message: "event has no prizes",
		});
		render(REQUIRED);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Reserve 2.5 USDC and create the event",
			}),
		);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("409 no_prizes");
		expect(alert).toHaveTextContent("event has no prizes");
	});

	it("uses the dedicated copy with the hash on create_build_replaced", async () => {
		mockSubmitCreate.mockResolvedValue({
			ok: false,
			status: 409,
			code: "create_build_replaced",
			message: "replaced",
			txHash: HASH,
		});
		render(REQUIRED);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Reserve 2.5 USDC and create the event",
			}),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: fund.create.sign }),
		);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("do not retry");
		expect(alert).toHaveTextContent(HASH);
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("lets the organizer discard a build and start over", async () => {
		render(REQUIRED);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Reserve 2.5 USDC and create the event",
			}),
		);
		await screen.findByRole("button", { name: fund.create.sign });

		fireEvent.click(screen.getByRole("button", { name: fund.create.discard }));

		expect(
			screen.queryByRole("button", { name: fund.create.sign }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", {
				name: "Reserve 2.5 USDC and create the event",
			}),
		).toBeEnabled();
	});
});

describe("FundAndCreate — step 1 (balance short)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockBuildDeposit.mockResolvedValue({
			ok: true,
			opId: OP_ID,
			unsignedTransactionXdr: "DEPOSIT-XDR",
		});
		mockBuildCreate.mockResolvedValue({
			ok: true,
			unsignedTransactionXdr: "CREATE-XDR",
			reward: REQUIRED,
			escrowEventId: ESCROW_ID,
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("defaults the amount to the shortfall and hides step 2", () => {
		render("10000000"); // 1 USDC of 2.5

		expect(screen.getByText(fund.deposit.title)).toBeInTheDocument();
		expect(screen.queryByText(fund.create.title)).not.toBeInTheDocument();
		expect(
			screen.getByRole("textbox", { name: /Amount to deposit/ }),
		).toHaveValue("1.5");
		expect(
			screen.getByRole("button", { name: "Deposit 1.5 USDC" }),
		).toBeEnabled();
	});

	it("allows raising the amount but never below the shortfall", () => {
		render("10000000");
		const input = screen.getByRole("textbox", { name: /Amount to deposit/ });

		fireEvent.change(input, { target: { value: "1.4" } });
		expect(
			screen.getByRole("button", { name: "Deposit 1.4 USDC" }),
		).toBeDisabled();
		expect(screen.getByText("Enter at least 1.5 USDC.")).toBeInTheDocument();

		fireEvent.change(input, { target: { value: "abc" } });
		expect(
			screen.getByRole("button", { name: "Deposit abc USDC" }),
		).toBeDisabled();

		fireEvent.change(input, { target: { value: "2" } });
		expect(
			screen.getByRole("button", { name: "Deposit 2 USDC" }),
		).toBeEnabled();
		expect(
			screen.queryByText("Enter at least 1.5 USDC."),
		).not.toBeInTheDocument();
	});

	it("builds the deposit, signs, submits, re-reads the balance and advances to step 2 on 200", async () => {
		mockSubmitDeposit.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "succeeded",
		});
		mockReadBalance.mockResolvedValue({ ok: true, balance: REQUIRED });
		render("10000000");

		fireEvent.click(screen.getByRole("button", { name: "Deposit 1.5 USDC" }));

		const sign = await screen.findByRole("button", { name: fund.deposit.sign });
		expect(mockBuildDeposit).toHaveBeenCalledWith(ADDRESS, "1.5");
		expect(sign).toHaveAttribute("data-xdr", "DEPOSIT-XDR");

		fireEvent.click(sign);

		await waitFor(() =>
			expect(mockSubmitDeposit).toHaveBeenCalledWith(ADDRESS, OP_ID, "SIGNED"),
		);
		await waitFor(() => expect(mockReadBalance).toHaveBeenCalledWith(ADDRESS));
		await screen.findByText(fund.create.title);
		expect(screen.getByTestId("balance")).toHaveTextContent("2.5 USDC");
		expect(screen.queryByText(fund.deposit.title)).not.toBeInTheDocument();
		expect(mockBuildCreate).not.toHaveBeenCalled();
	});

	it("on a 202 shows the hash and only advances when check-again reads enough balance", async () => {
		mockSubmitDeposit.mockResolvedValue({
			ok: true,
			txHash: HASH,
			status: "pending",
		});
		mockReadBalance
			.mockResolvedValueOnce({ ok: true, balance: "10000000" })
			.mockResolvedValueOnce({ ok: true, balance: "26000000" });
		render("10000000");

		fireEvent.click(screen.getByRole("button", { name: "Deposit 1.5 USDC" }));
		fireEvent.click(
			await screen.findByRole("button", { name: fund.deposit.sign }),
		);

		const status = await screen.findByRole("status");
		expect(status).toHaveTextContent(fund.deposit.pending);
		expect(
			screen.getByRole("link", { name: /0941dbcdd6/ }),
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: fund.checkAgain }));
		await waitFor(() => expect(mockReadBalance).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(screen.queryByText(fund.create.title)).not.toBeInTheDocument();

		fireEvent.click(
			await screen.findByRole("button", { name: fund.checkAgain }),
		);
		await screen.findByText(fund.create.title);
		expect(screen.getByTestId("balance")).toHaveTextContent("2.6 USDC");
	});

	it("renders Go's refusal verbatim under the deposit step", async () => {
		mockBuildDeposit.mockResolvedValue({
			ok: false,
			status: 403,
			code: "not_wallet_owner",
			message: "address is not the caller",
		});
		render("10000000");

		fireEvent.click(screen.getByRole("button", { name: "Deposit 1.5 USDC" }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("403 not_wallet_owner");
		expect(alert).toHaveTextContent("address is not the caller");
		expect(
			screen.queryByRole("button", { name: fund.deposit.sign }),
		).not.toBeInTheDocument();
	});

	it("surfaces a submit refusal and keeps the step", async () => {
		mockSubmitDeposit.mockResolvedValue({
			ok: false,
			status: 409,
			code: "envelope_mismatch",
			message: "differs",
		});
		render("10000000");

		fireEvent.click(screen.getByRole("button", { name: "Deposit 1.5 USDC" }));
		fireEvent.click(
			await screen.findByRole("button", { name: fund.deposit.sign }),
		);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("409 envelope_mismatch");
		expect(mockReadBalance).not.toHaveBeenCalled();
		expect(screen.queryByText(fund.create.title)).not.toBeInTheDocument();
	});

	it("lets the organizer change the amount after a build", async () => {
		render("10000000");

		fireEvent.click(screen.getByRole("button", { name: "Deposit 1.5 USDC" }));
		await screen.findByRole("button", { name: fund.deposit.sign });

		fireEvent.click(
			screen.getByRole("button", { name: fund.deposit.changeAmount }),
		);

		expect(
			screen.getByRole("textbox", { name: /Amount to deposit/ }),
		).toHaveValue("1.5");
		expect(
			screen.queryByRole("button", { name: fund.deposit.sign }),
		).not.toBeInTheDocument();
	});
});
