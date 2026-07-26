import { Networks, Transaction } from "@stellar/stellar-sdk";
import { env } from "@/lib/env";
import { STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar-network";
import type {
	ApproveMilestoneParams,
	DeployEscrowParams,
	DisputeMilestoneParams,
	EscrowProvider,
	EscrowState,
	FundEscrowParams,
	ReleaseMilestoneParams,
	ResolveMilestoneDisputeParams,
	SubmittedTx,
	UnsignedTx,
} from "./types";
import { EscrowProviderError } from "./types";

// Endpoint paths and payload shapes below are verified against the LIVE
// OpenAPI spec (https://dev.api.trustlesswork.com/docs-json) and real
// testnet calls in spikes/k01-trustless-work — never the prose docs site,
// which has been repeatedly wrong (see docs/architecture.md).

async function twRequest(
	path: string,
	method: "GET" | "POST" | "PUT",
	body?: unknown,
) {
	const res = await fetch(`${env.TW_API_URL}${path}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			"x-api-key": env.TW_API_KEY,
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => ({ raw: "non-json response" }));
	if (!res.ok || data.status === "FAILED") {
		throw new EscrowProviderError(
			`Trustless Work ${method} ${path} failed`,
			data,
		);
	}
	return data;
}

function toUnsignedTx(data: { unsignedTransaction: string }): UnsignedTx {
	return { unsignedXdr: data.unsignedTransaction };
}

export const trustlessWorkAdapter: EscrowProvider = {
	async deployEscrow(params: DeployEscrowParams): Promise<UnsignedTx> {
		const data = await twRequest("/deployer/multi-release", "POST", {
			signer: params.signerPublicKey,
			engagementId: params.engagementId,
			title: params.title,
			description: params.description,
			roles: params.roles,
			platformFee: params.platformFee,
			milestones: params.milestones,
			trustline: params.trustline,
		});
		return toUnsignedTx(data);
	},

	async fundEscrow(params: FundEscrowParams): Promise<UnsignedTx> {
		const data = await twRequest("/escrow/multi-release/fund-escrow", "POST", {
			contractId: params.contractId,
			signer: params.signerPublicKey,
			amount: params.amount,
		});
		return toUnsignedTx(data);
	},

	async approveMilestone(params: ApproveMilestoneParams): Promise<UnsignedTx> {
		const data = await twRequest(
			"/escrow/multi-release/approve-milestone",
			"POST",
			{
				contractId: params.contractId,
				milestoneIndex: String(params.milestoneIndex),
				approver: params.approverPublicKey,
			},
		);
		return toUnsignedTx(data);
	},

	async releaseMilestone(params: ReleaseMilestoneParams): Promise<UnsignedTx> {
		const data = await twRequest(
			"/escrow/multi-release/release-milestone-funds",
			"POST",
			{
				contractId: params.contractId,
				releaseSigner: params.releaseSignerPublicKey,
				milestoneIndex: String(params.milestoneIndex),
			},
		);
		return toUnsignedTx(data);
	},

	async disputeMilestone(params: DisputeMilestoneParams): Promise<UnsignedTx> {
		const data = await twRequest(
			"/escrow/multi-release/dispute-milestone",
			"POST",
			{
				contractId: params.contractId,
				milestoneIndex: String(params.milestoneIndex),
				signer: params.signerPublicKey,
			},
		);
		return toUnsignedTx(data);
	},

	async resolveMilestoneDispute(
		params: ResolveMilestoneDisputeParams,
	): Promise<UnsignedTx> {
		const data = await twRequest(
			"/escrow/multi-release/resolve-milestone-dispute",
			"POST",
			{
				contractId: params.contractId,
				disputeResolver: params.disputeResolverPublicKey,
				milestoneIndex: String(params.milestoneIndex),
				distributions: params.distributions,
			},
		);
		return toUnsignedTx(data);
	},

	async submitSignedTransaction(signedXdr: string): Promise<SubmittedTx> {
		const data = await twRequest("/helper/send-transaction", "POST", {
			signedXdr,
		});
		// txHash computed locally, not trusted from the TW response — it's
		// deterministic from the signed envelope + network passphrase, and
		// Principle 2 (docs/architecture.md) treats the chain, not a
		// third-party API response, as the source of truth. E04 confirms
		// this hash actually landed via Horizon. contractId, in contrast,
		// isn't something we can compute — it's assigned by TW/Soroban and
		// only reported here, on a deploy transaction's submission.
		const passphrase =
			env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
				? Networks.PUBLIC
				: STELLAR_NETWORK_PASSPHRASE;
		const tx = new Transaction(signedXdr, passphrase);
		const result: SubmittedTx = { txHash: tx.hash().toString("hex") };
		if (typeof data.contractId === "string") {
			result.contractId = data.contractId;
		}
		return result;
	},

	async getEscrow(contractId: string): Promise<EscrowState> {
		const url = `${env.TW_API_URL}/helper/get-escrow-by-contract-ids?contractIds[]=${encodeURIComponent(contractId)}&validateOnChain=true`;
		const res = await fetch(url, { headers: { "x-api-key": env.TW_API_KEY } });
		const data = await res.json();
		if (!res.ok) {
			throw new EscrowProviderError(
				`Trustless Work GET escrow ${contractId} failed`,
				data,
			);
		}
		return Array.isArray(data) ? data[0] : data;
	},
};
