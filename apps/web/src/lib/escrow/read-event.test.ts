import {
	Address,
	nativeToScVal,
	rpc,
	SorobanDataBuilder,
	xdr,
} from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EscrowReadError, readEscrowEvent } from "./read-event";

const ADMIN = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const JUDGE = "GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB";
const TOKEN = "CAD5IOA2FFSUTRIHEK6YQ2BPO2JVDPXYRXBVMPBBWFQEWRWKFRG36TQH";
const EVENT_ID = "0123456789abcdef0123456789abcdef";

// Mirrors the contract's `Event` struct as Soroban encodes it: a map with
// symbol keys, sorted, the `EventState` enum as its u32 repr.
function eventScVal(overrides: Partial<Record<string, xdr.ScVal>> = {}) {
	const entries: Record<string, xdr.ScVal> = {
		admin: new Address(ADMIN).toScVal(),
		deadline: xdr.ScVal.scvVoid(),
		judge: new Address(JUDGE).toScVal(),
		judging_deadline: xdr.ScVal.scvVoid(),
		resolver: new Address(ADMIN).toScVal(),
		reward: nativeToScVal(BigInt(150_000_000), { type: "i128" }),
		state: xdr.ScVal.scvU32(2),
		token: new Address(TOKEN).toScVal(),
		...overrides,
	};
	return xdr.ScVal.scvMap(
		Object.keys(entries)
			.sort()
			.map(
				(key) =>
					new xdr.ScMapEntry({
						key: xdr.ScVal.scvSymbol(key),
						val: entries[key],
					}),
			),
	);
}

function mockSimulate(response: unknown) {
	return vi
		.spyOn(rpc.Server.prototype, "simulateTransaction")
		.mockResolvedValue(response as rpc.Api.SimulateTransactionResponse);
}

function successResponse(retval: xdr.ScVal) {
	return {
		id: "1",
		latestLedger: 100,
		events: [],
		_parsed: true,
		transactionData: new SorobanDataBuilder(),
		minResourceFee: "0",
		result: { auth: [], retval },
	};
}

describe("readEscrowEvent", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("simulates get_event against the configured contract and decodes the struct", async () => {
		const spy = mockSimulate(successResponse(eventScVal()));

		const event = await readEscrowEvent(EVENT_ID);

		expect(event).toEqual({
			reward: "150000000",
			state: "InProgress",
			token: TOKEN,
			admin: ADMIN,
			judge: JUDGE,
		});

		// The simulated transaction is a single invoke_host_function calling
		// get_event with the 16-byte event id.
		const tx = spy.mock.calls[0][0];
		expect(tx.operations).toHaveLength(1);
		const op = tx.operations[0];
		expect(op.type).toBe("invokeHostFunction");
		const invoke = (op as { func: xdr.HostFunction }).func
			.invokeContract()
			.functionName()
			.toString();
		expect(invoke).toBe("get_event");
		const contractId = Address.fromScAddress(
			(op as { func: xdr.HostFunction }).func
				.invokeContract()
				.contractAddress(),
		).toString();
		expect(contractId).toBe(process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID);
		const arg = (op as { func: xdr.HostFunction }).func
			.invokeContract()
			.args()[0]
			.bytes()
			.toString("hex");
		expect(arg).toBe(EVENT_ID);
	});

	it("maps every known EventState and labels unknown ones", async () => {
		const cases: Array<[number, string]> = [
			[0, "Created"],
			[1, "WaitingForStart"],
			[3, "Ended"],
			[4, "Compensated"],
			[99, "Cancelled"],
			[7, "Unknown(7)"],
		];
		for (const [repr, label] of cases) {
			vi.restoreAllMocks();
			mockSimulate(
				successResponse(eventScVal({ state: xdr.ScVal.scvU32(repr) })),
			);
			expect((await readEscrowEvent(EVENT_ID)).state).toBe(label);
		}
	});

	it("throws EscrowReadError when the simulation fails", async () => {
		mockSimulate({
			id: "1",
			latestLedger: 100,
			events: [],
			_parsed: true,
			error: "HostError: Error(Contract, #4)",
		});

		await expect(readEscrowEvent(EVENT_ID)).rejects.toThrow(EscrowReadError);
		await expect(readEscrowEvent(EVENT_ID)).rejects.toThrow(/Contract, #4/);
	});

	it("rejects a malformed escrowEventId before touching the RPC", async () => {
		const spy = mockSimulate(successResponse(eventScVal()));

		await expect(readEscrowEvent("not-hex")).rejects.toThrow(EscrowReadError);
		await expect(readEscrowEvent(EVENT_ID.toUpperCase())).rejects.toThrow(
			EscrowReadError,
		);
		expect(spy).not.toHaveBeenCalled();
	});
});
