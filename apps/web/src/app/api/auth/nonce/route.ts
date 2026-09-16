import { NextResponse } from "next/server";
import { issueAuthNonce } from "@/lib/wallet/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const address = searchParams.get("address");

	if (!address) {
		return NextResponse.json(
			{ error: "Missing address parameter" },
			{ status: 400 },
		);
	}

	try {
		const result = await issueAuthNonce(address);
		return NextResponse.json(result);
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "Failed to issue nonce";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
