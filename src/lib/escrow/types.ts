// EscrowProvider port (ADR-001): domain code depends on this interface, never
// on Trustless Work's request/response shapes directly. TrustlessWorkAdapter
// is the only implementation today.

export interface EscrowRoles {
	approver: string;
	serviceProvider: string;
	platformAddress: string;
	releaseSigner: string;
	disputeResolver: string;
}

export interface EscrowMilestoneInput {
	description: string;
	amount: number;
	receiver: string;
}

export interface EscrowTrustline {
	symbol: string;
	address: string;
}

export interface UnsignedTx {
	unsignedXdr: string;
}

export interface SubmittedTx {
	txHash: string;
	// Only present when the submitted transaction was a deploy — the build
	// step (`/deployer/multi-release`) returns only unsignedTransaction; the
	// contract address is assigned and reported by `/helper/send-transaction`
	// after submission, never before (verified against the live OpenAPI spec).
	contractId?: string;
}

export interface DeployEscrowParams {
	signerPublicKey: string;
	engagementId: string;
	title: string;
	description: string;
	roles: EscrowRoles;
	// Unit unverified beyond "0 works" (every spike used 0) — treat as
	// TW's raw platformFee value until a nonzero case is tested end-to-end.
	platformFee: number;
	milestones: EscrowMilestoneInput[];
	trustline: EscrowTrustline;
}

export interface FundEscrowParams {
	contractId: string;
	signerPublicKey: string;
	amount: number;
}

export interface ApproveMilestoneParams {
	contractId: string;
	milestoneIndex: number;
	approverPublicKey: string;
}

export interface ReleaseMilestoneParams {
	contractId: string;
	milestoneIndex: number;
	releaseSignerPublicKey: string;
}

export interface DisputeMilestoneParams {
	contractId: string;
	milestoneIndex: number;
	signerPublicKey: string;
}

export interface Distribution {
	address: string;
	amount: number;
}

export interface ResolveMilestoneDisputeParams {
	contractId: string;
	milestoneIndex: number;
	disputeResolverPublicKey: string;
	distributions: Distribution[];
}

export interface EscrowMilestoneState {
	description: string;
	amount: number;
	receiver: string;
	status: string;
	evidence: string;
	// Field presence confirmed (spikes 03/06), exact key set beyond
	// disputed/released/resolved not fully mapped yet.
	flags: Record<string, boolean>;
}

export interface EscrowState {
	contractId: string;
	engagementId: string;
	title: string;
	description: string;
	roles: EscrowRoles;
	platformFee: number;
	milestones: EscrowMilestoneState[];
	trustline: EscrowTrustline;
	balance: number;
}

export class EscrowProviderError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "EscrowProviderError";
	}
}

export interface EscrowProvider {
	deployEscrow(params: DeployEscrowParams): Promise<UnsignedTx>;
	fundEscrow(params: FundEscrowParams): Promise<UnsignedTx>;
	approveMilestone(params: ApproveMilestoneParams): Promise<UnsignedTx>;
	releaseMilestone(params: ReleaseMilestoneParams): Promise<UnsignedTx>;
	disputeMilestone(params: DisputeMilestoneParams): Promise<UnsignedTx>;
	resolveMilestoneDispute(
		params: ResolveMilestoneDisputeParams,
	): Promise<UnsignedTx>;
	submitSignedTransaction(signedXdr: string): Promise<SubmittedTx>;
	getEscrow(contractId: string): Promise<EscrowState>;
}
