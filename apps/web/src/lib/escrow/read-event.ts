import "server-only";

import { Buffer } from "node:buffer";
import {
	Account,
	Contract,
	Keypair,
	rpc,
	scValToNative,
	TransactionBuilder,
	xdr,
} from "@stellar/stellar-sdk";
import { env } from "@/lib/env";

// The one place the web app talks to Soroban RPC directly, and it is
// read-only: a `get_event` simulation so the public page shows the reserved
// amount from the chain, not from Prisma (issue #15). Every write still goes
// through services/core-go.

// smart-contracts/.../event-escrow/src/types.rs `EventState` (u32 repr).
export const ESCROW_EVENT_STATES = {
	0: "Created",
	1: "WaitingForStart",
	2: "InProgress",
	3: "Ended",
	4: "Compensated",
	99: "Cancelled",
} as const;

export type EscrowEventState =
	(typeof ESCROW_EVENT_STATES)[keyof typeof ESCROW_EVENT_STATES];

export interface EscrowEvent {
	/** i128 reward in the token's smallest units, as a decimal string. */
	reward: string;
	state: EscrowEventState | `Unknown(${number})`;
	token: string;
	admin: string;
	judge: string;
}

const EVENT_ID_HEX = /^[0-9a-f]{32}$/;

// Simulation needs a source account but never submits, so any well-formed
// account works; a throwaway keypair avoids a network round trip for
// sequence numbers.
const SIMULATION_SOURCE = Keypair.random().publicKey();

export class EscrowReadError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EscrowReadError";
	}
}

function toReward(value: unknown): string {
	if (typeof value === "bigint" || typeof value === "number") {
		return value.toString();
	}
	throw new EscrowReadError(
		`get_event returned a non-numeric reward: ${typeof value}`,
	);
}

function toState(value: unknown): EscrowEvent["state"] {
	const n = typeof value === "bigint" ? Number(value) : value;
	if (typeof n !== "number") {
		throw new EscrowReadError(
			`get_event returned a non-numeric state: ${typeof value}`,
		);
	}
	return (
		ESCROW_EVENT_STATES[n as keyof typeof ESCROW_EVENT_STATES] ??
		`Unknown(${n})`
	);
}

function toAddress(value: unknown, field: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new EscrowReadError(`get_event returned a non-address ${field}`);
	}
	return value;
}

export async function readEscrowEvent(
	escrowEventId: string,
): Promise<EscrowEvent> {
	if (!EVENT_ID_HEX.test(escrowEventId)) {
		throw new EscrowReadError(
			"escrowEventId must be 32 lowercase hex characters (the contract's BytesN<16>)",
		);
	}

	// env.ts already refuses mainnet without SOROBAN_RPC_URL; this is the
	// type-level echo of that guard.
	const rpcUrl = env.sorobanRpcUrl;
	if (!rpcUrl) {
		throw new EscrowReadError("SOROBAN_RPC_URL is not configured");
	}
	const server = new rpc.Server(rpcUrl, {
		allowHttp: rpcUrl.startsWith("http://"),
	});
	const contract = new Contract(env.NEXT_PUBLIC_ESCROW_CONTRACT_ID);
	const eventIdArg = xdr.ScVal.scvBytes(Buffer.from(escrowEventId, "hex"));

	const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
		fee: "100",
		networkPassphrase: env.networkPassphrase,
	})
		.addOperation(contract.call("get_event", eventIdArg))
		.setTimeout(30)
		.build();

	const sim = await server.simulateTransaction(tx);
	if (rpc.Api.isSimulationError(sim)) {
		throw new EscrowReadError(`get_event simulation failed: ${sim.error}`);
	}
	if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
		throw new EscrowReadError("get_event simulation returned no result");
	}

	const native = scValToNative(sim.result.retval) as Record<string, unknown>;
	return {
		reward: toReward(native.reward),
		state: toState(native.state),
		token: toAddress(native.token, "token"),
		admin: toAddress(native.admin, "admin"),
		judge: toAddress(native.judge, "judge"),
	};
}
