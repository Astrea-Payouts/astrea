// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";
import { SignStep } from "./sign-step";

const ADDRESS = "GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L";
const XDR = "AAAAAgAAAAB";
const TX_HASH =
	"ee325b0624b2d29de14834a02b54ba5faf65c7e0b07b668c429715df6e3af994";

const { mockSign } = vi.hoisted(() => ({ mockSign: vi.fn() }));

vi.mock("@/lib/wallet/kit", () => ({
	StellarWalletsKit: { signTransaction: mockSign },
}));

const copy = messages.SignStep;

describe("SignStep", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("asks the kit to sign with the address and the network passphrase", async () => {
		mockSign.mockResolvedValue({ signedTxXdr: "SIGNED" });
		const onSigned = vi.fn().mockResolvedValue({
			txHash: TX_HASH,
			status: "succeeded",
		});
		renderWithIntl(
			<SignStep unsignedXdr={XDR} address={ADDRESS} onSigned={onSigned} />,
		);

		fireEvent.click(screen.getByRole("button", { name: copy.sign }));

		await waitFor(() => expect(onSigned).toHaveBeenCalledWith("SIGNED"));
		expect(mockSign).toHaveBeenCalledWith(XDR, {
			address: ADDRESS,
			networkPassphrase: expect.stringContaining("Test SDF Network"),
		});
	});

	it("shows the failed state with a retry label when the wallet rejects, and never submits", async () => {
		mockSign.mockRejectedValue(new Error("User declined access"));
		const onSigned = vi.fn();
		renderWithIntl(
			<SignStep unsignedXdr={XDR} address={ADDRESS} onSigned={onSigned} />,
		);

		fireEvent.click(screen.getByRole("button", { name: copy.sign }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"User declined access",
		);
		expect(screen.getByRole("button", { name: copy.retry })).toBeEnabled();
		expect(onSigned).not.toHaveBeenCalled();
	});

	it("falls back to the rejected copy when the wallet throws nothing readable", async () => {
		mockSign.mockRejectedValue({});
		renderWithIntl(
			<SignStep unsignedXdr={XDR} address={ADDRESS} onSigned={vi.fn()} />,
		);

		fireEvent.click(screen.getByRole("button", { name: copy.sign }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			copy.signRejected,
		);
	});

	it("renders confirmed with the hash link once the submit resolves", async () => {
		mockSign.mockResolvedValue({ signedTxXdr: "SIGNED" });
		const onSigned = vi
			.fn()
			.mockResolvedValue({ txHash: TX_HASH, status: "succeeded" });
		renderWithIntl(
			<SignStep unsignedXdr={XDR} address={ADDRESS} onSigned={onSigned} />,
		);

		fireEvent.click(screen.getByRole("button", { name: copy.sign }));

		const status = await screen.findByRole("status");
		expect(status).toHaveTextContent(copy.confirmed);
		const link = screen.getByRole("link", { name: /ee325b06/ });
		expect(link).toHaveAttribute("href", expect.stringContaining(TX_HASH));
		// The sign button is gone: nothing invites a second signature. (The
		// remaining button is TxHashLink's copy control.)
		expect(
			screen.queryByRole("button", { name: copy.sign }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: copy.retry }),
		).not.toBeInTheDocument();
	});

	it("shows the pending copy, not a failure, for Go's 202", async () => {
		mockSign.mockResolvedValue({ signedTxXdr: "SIGNED" });
		const onSigned = vi
			.fn()
			.mockResolvedValue({ txHash: TX_HASH, status: "pending" });
		renderWithIntl(
			<SignStep unsignedXdr={XDR} address={ADDRESS} onSigned={onSigned} />,
		);

		fireEvent.click(screen.getByRole("button", { name: copy.sign }));

		const status = await screen.findByRole("status");
		expect(status).toHaveTextContent(copy.pending);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("shows the submit error message and offers a retry when onSigned throws", async () => {
		mockSign.mockResolvedValue({ signedTxXdr: "SIGNED" });
		const onSigned = vi
			.fn()
			.mockRejectedValue(new Error("409 envelope_mismatch"));
		renderWithIntl(
			<SignStep
				unsignedXdr={XDR}
				address={ADDRESS}
				onSigned={onSigned}
				label="Sign and release"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Sign and release" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"409 envelope_mismatch",
		);
		expect(screen.getByRole("button", { name: copy.retry })).toBeEnabled();
	});
});
