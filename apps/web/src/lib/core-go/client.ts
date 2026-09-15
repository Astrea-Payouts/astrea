import "server-only";

import { env } from "@/lib/env";
import type {
	CoreGoErrorBody,
	CoreGoErrorCode,
	ReleaseAssignment,
	ReleaseBuildRequest,
	ReleaseBuildResponse,
	ReleaseSubmitRequest,
	ReleaseSubmitResponse,
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

async function post<TRes>(
	path: string,
	wallet: string,
	body: unknown,
): Promise<TRes> {
	const { url, token } = config();
	// The token travels only in the Authorization header — never in the URL,
	// never in a log line, never in a client component's props.
	const res = await fetch(new URL(path, url), {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"X-Astrea-Wallet": wallet,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(body),
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
