import { Account, Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar-network";
import { trustlessWorkAdapter } from "./trustless-work-adapter";
import { EscrowProviderError } from "./types";

const ROLES = {
	approver: "GAPPROVER00000000000000000000000000000000000000000000",
	serviceProvider: "GSERVICE0000000000000000000000000000000000000000000000",
	platformAddress: "GPLATFORM000000000000000000000000000000000000000000000",
	releaseSigner: "GAPPROVER00000000000000000000000000000000000000000000",
	disputeResolver: "GRESOLVER0000000000000000000000000000000000000000000000",
};

function jsonResponse(body: unknown, ok = true, status = 200) {
	return {
		ok,
		status,
		json: async () => body,
	} as Response;
}

describe("trustlessWorkAdapter", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("deployEscrow sends the verified payload shape and returns unsignedXdr + contractId", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse({ unsignedTransaction: "AAAA...", contractId: "CCONTRACT" }),
		);

		const result = await trustlessWorkAdapter.deployEscrow({
			signerPublicKey: ROLES.platformAddress,
			engagementId: "astrea-1",
			title: "Test event",
			description: "desc",
			roles: ROLES,
			platformFee: 0,
			milestones: [
				{ description: "Prize", amount: 100, receiver: ROLES.approver },
			],
			trustline: {
				symbol: "USDC",
				address: "GISSUER00000000000000000000000000000000000000000000000",
			},
		});

		expect(result).toEqual({ unsignedXdr: "AAAA...", contractId: "CCONTRACT" });
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toContain("/deployer/multi-release");
		expect(JSON.parse(init?.body as string)).toMatchObject({
			signer: ROLES.platformAddress,
			roles: ROLES,
		});
	});

	it("throws EscrowProviderError with the TW payload when the API rejects the call", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse(
				{
					statusCode: 400,
					message:
						"Only the platform address should be able to execute this function.",
				},
				false,
				400,
			),
		);

		await expect(
			trustlessWorkAdapter.fundEscrow({
				contractId: "CCONTRACT",
				signerPublicKey: ROLES.approver,
				amount: 10,
			}),
		).rejects.toThrow(EscrowProviderError);
	});

	it("approveMilestone stringifies milestoneIndex, matching the verified API shape", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse({ unsignedTransaction: "AAAA..." }),
		);

		await trustlessWorkAdapter.approveMilestone({
			contractId: "CCONTRACT",
			milestoneIndex: 0,
			approverPublicKey: ROLES.approver,
		});

		const [, init] = vi.mocked(fetch).mock.calls[0];
		expect(JSON.parse(init?.body as string).milestoneIndex).toBe("0");
	});

	it("resolveMilestoneDispute forwards distributions verbatim", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse({ unsignedTransaction: "AAAA..." }),
		);

		const distributions = [{ address: ROLES.serviceProvider, amount: 99.7 }];
		await trustlessWorkAdapter.resolveMilestoneDispute({
			contractId: "CCONTRACT",
			milestoneIndex: 0,
			disputeResolverPublicKey: ROLES.disputeResolver,
			distributions,
		});

		const [, init] = vi.mocked(fetch).mock.calls[0];
		expect(JSON.parse(init?.body as string).distributions).toEqual(
			distributions,
		);
	});

	it("submitSignedTransaction computes the tx hash locally instead of trusting the response body", async () => {
		const keypair = Keypair.random();
		const account = new Account(keypair.publicKey(), "1");
		const tx = new TransactionBuilder(account, {
			fee: "100",
			networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
		})
			.setTimeout(30)
			.build();
		tx.sign(keypair);
		const signedXdr = tx.toXDR();
		const expectedHash = tx.hash().toString("hex");

		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse({ status: "SUCCESS", message: "sent" }),
		);

		const result =
			await trustlessWorkAdapter.submitSignedTransaction(signedXdr);
		expect(result.txHash).toBe(expectedHash);
	});

	it("getEscrow unwraps the array response from get-escrow-by-contract-ids", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse([{ contractId: "CCONTRACT", milestones: [] }]),
		);

		const result = await trustlessWorkAdapter.getEscrow("CCONTRACT");
		expect(result.contractId).toBe("CCONTRACT");
	});
});
