import type { Prisma } from "@/generated/prisma/client";
import { OpStatus } from "@/generated/prisma/enums";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";
import { db } from "@/lib/db";
import { decidePrepare, decideSubmit } from "./idempotency";

interface StoredResult {
	txHash: string;
	// Only present for a deploy operation's result — see types.ts SubmittedTx.
	contractId?: string;
}

interface StoredPayload {
	request: unknown;
	result?: StoredResult | { error: string };
}

function readPayload(payload: Prisma.JsonValue): StoredPayload {
	return payload as unknown as StoredPayload;
}

function toOpRecord(
	row: { status: OpStatus; payload: Prisma.JsonValue } | null,
) {
	if (!row) return null;
	const payload = readPayload(row.payload);
	const result =
		payload.result && "txHash" in payload.result ? payload.result : undefined;
	return {
		status: row.status,
		txHash: result?.txHash,
		contractId: result?.contractId,
	};
}

export interface PrepareOperationParams {
	idempotencyKey: string;
	operation: string;
	requestPayload: Prisma.InputJsonValue;
	build: () => Promise<{ unsignedXdr: string }>;
}

export type PrepareOperationResult =
	| { alreadySucceeded: true; txHash: string; contractId?: string }
	| { alreadySucceeded: false; unsignedXdr: string };

// Building an unsigned transaction has no on-chain side effect (Stellar
// sequence numbers only advance on submission), so a race between two
// concurrent first-time prepares for the same key is harmless — both may
// build, only one signed result will ever be submitted successfully
// (see submitOperation).
export async function prepareOperation(
	params: PrepareOperationParams,
): Promise<PrepareOperationResult> {
	const existing = await db.opLog.findUnique({
		where: { idempotencyKey: params.idempotencyKey },
	});
	const decision = decidePrepare(toOpRecord(existing));
	if (decision.action === "already-succeeded") {
		return {
			alreadySucceeded: true,
			txHash: decision.txHash,
			contractId: decision.contractId,
		};
	}

	const payload: StoredPayload = { request: params.requestPayload };
	if (existing) {
		await db.opLog.update({
			where: { idempotencyKey: params.idempotencyKey },
			data: {
				status: OpStatus.PENDING,
				payload: payload as unknown as Prisma.InputJsonValue,
			},
		});
	} else {
		try {
			await db.opLog.create({
				data: {
					idempotencyKey: params.idempotencyKey,
					operation: params.operation,
					status: OpStatus.PENDING,
					payload: payload as unknown as Prisma.InputJsonValue,
				},
			});
		} catch (err) {
			// Concurrent first-time prepare already inserted the row — fine,
			// proceed to build regardless (see comment above).
			if (
				!(err instanceof PrismaClientKnownRequestError && err.code === "P2002")
			) {
				throw err;
			}
		}
	}

	const { unsignedXdr } = await params.build();
	return { alreadySucceeded: false, unsignedXdr };
}

export interface SubmitOperationParams {
	idempotencyKey: string;
	signedXdr: string;
	submit: (signedXdr: string) => Promise<StoredResult>;
}

export interface SubmitOperationResult {
	txHash: string;
	contractId?: string;
	alreadySucceeded: boolean;
}

// Resubmitting the IDENTICAL signed XDR twice is safe at the Stellar/Horizon
// layer (submission is idempotent per transaction hash) — this OpLog guard
// exists to skip redundant network calls and keep a clean audit trail, not
// to prevent a double-payment that the network itself already rules out.
export async function submitOperation(
	params: SubmitOperationParams,
): Promise<SubmitOperationResult> {
	const existing = await db.opLog.findUnique({
		where: { idempotencyKey: params.idempotencyKey },
	});
	const decision = decideSubmit(toOpRecord(existing));
	if (decision.action === "already-succeeded") {
		return {
			txHash: decision.txHash,
			contractId: decision.contractId,
			alreadySucceeded: true,
		};
	}

	const priorRequest = existing
		? readPayload(existing.payload).request
		: undefined;
	try {
		const result = await params.submit(params.signedXdr);
		const payload: StoredPayload = { request: priorRequest, result };
		await db.opLog.update({
			where: { idempotencyKey: params.idempotencyKey },
			data: {
				status: OpStatus.SUCCEEDED,
				payload: payload as unknown as Prisma.InputJsonValue,
			},
		});
		return {
			txHash: result.txHash,
			contractId: result.contractId,
			alreadySucceeded: false,
		};
	} catch (err) {
		const payload: StoredPayload = {
			request: priorRequest,
			result: { error: err instanceof Error ? err.message : String(err) },
		};
		await db.opLog.update({
			where: { idempotencyKey: params.idempotencyKey },
			data: {
				status: OpStatus.FAILED,
				payload: payload as unknown as Prisma.InputJsonValue,
			},
		});
		throw err;
	}
}
