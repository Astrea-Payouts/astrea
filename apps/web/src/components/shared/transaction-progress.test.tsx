import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TransactionProgress } from "./transaction-progress";

describe("TransactionProgress Component", () => {
	const sampleTxHash =
		"6b041eb9bb62939316d9a04ad53cf5db3ce2bb9cf7bcfe21609101ad4043b27b";

	it("renders idle state with ready badge and 0% progress", () => {
		const html = renderToStaticMarkup(
			<TransactionProgress phase="idle" progress={0} />,
		);

		expect(html).toContain("Ready to Submit");
		expect(html).toContain("Ready");
		expect(html).toContain('aria-valuenow="0"');
		expect(html).toContain('role="progressbar"');
	});

	it("renders building state with preparing badge", () => {
		const html = renderToStaticMarkup(
			<TransactionProgress phase="building" progress={25} />,
		);

		expect(html).toContain("Preparing Transaction");
		expect(html).toContain("Preparing");
		expect(html).toContain('aria-valuenow="25"');
	});

	it("renders awaiting_signature state with signature badge", () => {
		const html = renderToStaticMarkup(
			<TransactionProgress phase="awaiting_signature" progress={50} />,
		);

		expect(html).toContain("Signature Requested");
		expect(html).toContain("Awaiting Signature");
		expect(html).toContain('aria-valuenow="50"');
	});

	it("renders pending state with awaiting consensus badge and race progress", () => {
		const html = renderToStaticMarkup(
			<TransactionProgress phase="pending" progress={88.5} />,
		);

		expect(html).toContain("Waiting for Ledger Consensus");
		expect(html).toContain("Awaiting Ledger Consensus");
		expect(html).toContain('aria-valuenow="89"');
	});

	it("renders confirmed state with 100% progress and TxHashLink", () => {
		const html = renderToStaticMarkup(
			<TransactionProgress
				phase="confirmed"
				progress={100}
				txHash={sampleTxHash}
				network="testnet"
			/>,
		);

		expect(html).toContain("Transaction Confirmed");
		expect(html).toContain("Confirmed On-Chain");
		expect(html).toContain('aria-valuenow="100"');
		expect(html).toContain("100% Reconciled");
		expect(html).toContain("Tx Receipt:");
		expect(html).toContain("stellar.expert/explorer/testnet/tx/");
	});

	it("renders failed state with error message and retry button", () => {
		const onRetry = vi.fn();
		const html = renderToStaticMarkup(
			<TransactionProgress
				phase="failed"
				progress={0}
				error="User rejected transaction in wallet."
				onRetry={onRetry}
			/>,
		);

		expect(html).toContain("Transaction Failed");
		expect(html).toContain("Failed");
		expect(html).toContain("User rejected transaction in wallet.");
		expect(html).toContain("Retry Transaction");
	});

	it("hides step indicator in compact mode", () => {
		const fullHtml = renderToStaticMarkup(
			<TransactionProgress phase="building" progress={25} compact={false} />,
		);
		const compactHtml = renderToStaticMarkup(
			<TransactionProgress phase="building" progress={25} compact={true} />,
		);

		expect(fullHtml).toContain("1. Building");
		expect(compactHtml).not.toContain("1. Building");
	});
});
