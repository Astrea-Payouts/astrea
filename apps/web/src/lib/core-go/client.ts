import "server-only";

import { env } from "@/lib/env";
import type {
	CoreGoErrorBody,
	CoreGoErrorCode,
	CreateBuildResponse,
	CreateSubmitRequest,
	CreateSubmitResponse,
	DepositBuildRequest,
	DepositBuildResponse,
	DepositSubmitRequest,
	DepositSubmitResponse,
	ReleaseAssignment,
	ReleaseBuildRequest,
	ReleaseBuildResponse,
	ReleaseSubmitRequest,
	ReleaseSubmitResponse,
	StartBuildResponse,
	StartQuoteResponse,
	StartSubmitRequest,
	StartSubmitResponse,
	WalletBalanceResponse,
} from "./types";

// Go's `{ error: { code, message } }` envelope, surfaced so screens can show
// `envelope_mismatch` or `not_judge` verbatim (issue #15, decision 2).
export class CoreGoError extends Error {
	readonly status: number;
	readonly code: CoreGoErrorCode;

	constructor(status: number, code: CoreGoErrorCode, message: string) {
		super(message);
		this.name = "CoreGoError";
		this.status = status;
		this.code = code;
	}
}

// Go answered with something that is not its JSON envelope — a proxy page,
// a crashed process, a wrong CORE_GO_URL. Distinct from CoreGoError so a
// screen never renders an HTML body as if it were Go's message.
export class CoreGoTransportError extends Error {
	readonly status: number;

	constructor(status: number, detail: string) {
		super(`core-go returned a non-JSON response (HTTP ${status}): ${detail}`);
		this.name = "CoreGoTransportError";
		this.status = status;
	}
}

// CORE_GO_URL / CORE_GO_SERVICE_TOKEN are optional in env.ts so a deploy
// without Go still boots; the first call that needs Go fails here, before
// any fetch, with a message that names the missing var instead of an
// "Invalid URL" from the runtime.
export class CoreGoConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CoreGoConfigError";
	}
}

function config(): { url: string; token: string } {
	const url = env.CORE_GO_URL;
	const token = env.CORE_GO_SERVICE_TOKEN;
	if (!url) throw new CoreGoConfigError("CORE_GO_URL is not configured");
	if (!token) {
		throw new CoreGoConfigError("CORE_GO_SERVICE_TOKEN is not configured");
	}
	return { url, token };
}

function isErrorBody(value: unknown): value is CoreGoErrorBody {
	if (typeof value !== "object" || value === null || !("error" in value)) {
		return false;
	}
	const err = (value as { error: unknown }).error;
	return (
		typeof err === "object" &&
		err !== null &&
		typeof (err as { code?: unknown }).code === "string" &&
		typeof (err as { message?: unknown }).message === "string"
	);
}

async function request<TRes>(
	method: "GET" | "POST",
	path: string,
	wallet: string,
	body?: unknown,
): Promise<TRes> {
	const { url, token } = config();
	// The token travels only in the Authorization header — never in the URL,
	// never in a log line, never in a client component's props.
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		"X-Astrea-Wallet": wallet,
		Accept: "application/json",
	};
	if (method === "POST") headers["Content-Type"] = "application/json";
	const res = await fetch(new URL(path, url), {
		method,
		headers,
		body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
		cache: "no-store",
	});

	const text = await res.text();
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		throw new CoreGoTransportError(res.status, text.slice(0, 200));
	}

	if (!res.ok) {
		if (isErrorBody(json)) {
			throw new CoreGoError(res.status, json.error.code, json.error.message);
		}
		throw new CoreGoTransportError(res.status, text.slice(0, 200));
	}

	return json as TRes;
}

function post<TRes>(path: string, wallet: string, body: unknown) {
	return request<TRes>("POST", path, wallet, body);
}

function get<TRes>(path: string, wallet: string) {
	return request<TRes>("GET", path, wallet);
}

export async function releaseBuild(
	eventId: string,
	wallet: string,
	assignments: ReleaseAssignment[],
): Promise<ReleaseBuildResponse> {
	const body: ReleaseBuildRequest = { assignments };
	return post<ReleaseBuildResponse>(
		`/events/${encodeURIComponent(eventId)}/release/build`,
		wallet,
		body,
	);
}

export async function releaseSubmit(
	eventId: string,
	wallet: string,
	signedTransactionXdr: string,
): Promise<ReleaseSubmitResponse> {
	const body: ReleaseSubmitRequest = { signedTransactionXdr };
	return post<ReleaseSubmitResponse>(
		`/events/${encodeURIComponent(eventId)}/release/submit`,
		wallet,
		body,
	);
}

// Organizer path (#199). Go authorizes every call against X-Astrea-Wallet:
// the balance and deposit routes require the path address to be the caller,
// create requires the caller to be the event's organizer wallet.

export async function walletBalance(
	address: string,
	wallet: string,
): Promise<WalletBalanceResponse> {
	return get<WalletBalanceResponse>(
		`/wallets/${encodeURIComponent(address)}/balance`,
		wallet,
	);
}

export async function depositBuild(
	address: string,
	wallet: string,
	amount: string,
): Promise<DepositBuildResponse> {
	const body: DepositBuildRequest = { amount };
	return post<DepositBuildResponse>(
		`/wallets/${encodeURIComponent(address)}/deposit/build`,
		wallet,
		body,
	);
}

export async function depositSubmit(
	address: string,
	wallet: string,
	opId: string,
	signedTransactionXdr: string,
): Promise<DepositSubmitResponse> {
	const body: DepositSubmitRequest = { opId, signedTransactionXdr };
	return post<DepositSubmitResponse>(
		`/wallets/${encodeURIComponent(address)}/deposit/submit`,
		wallet,
		body,
	);
}

export async function createBuild(
	eventId: string,
	wallet: string,
): Promise<CreateBuildResponse> {
	return post<CreateBuildResponse>(
		`/events/${encodeURIComponent(eventId)}/create/build`,
		wallet,
		{},
	);
}

export async function createSubmit(
	eventId: string,
	wallet: string,
	signedTransactionXdr: string,
): Promise<CreateSubmitResponse> {
	const body: CreateSubmitRequest = { signedTransactionXdr };
	return post<CreateSubmitResponse>(
		`/events/${encodeURIComponent(eventId)}/create/submit`,
		wallet,
		body,
	);
}

// Go-live (#11 PR 2). Same authorization as create: the caller must be the
// event's organizer wallet, the event CREATED with an escrowEventId.

export async function startQuote(
	eventId: string,
	wallet: string,
): Promise<StartQuoteResponse> {
	return get<StartQuoteResponse>(
		`/events/${encodeURIComponent(eventId)}/start/quote`,
		wallet,
	);
}

export async function startBuild(
	eventId: string,
	wallet: string,
): Promise<StartBuildResponse> {
	return post<StartBuildResponse>(
		`/events/${encodeURIComponent(eventId)}/start/build`,
		wallet,
		{},
	);
}

export async function startSubmit(
	eventId: string,
	wallet: string,
	signedTransactionXdr: string,
): Promise<StartSubmitResponse> {
	const body: StartSubmitRequest = { signedTransactionXdr };
	return post<StartSubmitResponse>(
		`/events/${encodeURIComponent(eventId)}/start/submit`,
		wallet,
		body,
	);
}
