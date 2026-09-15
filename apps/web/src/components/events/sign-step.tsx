"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { TxHashLink } from "@/components/tx-hash-link";
import { Button } from "@/components/ui/button";
import {
	STELLAR_NETWORK,
	STELLAR_NETWORK_PASSPHRASE,
} from "@/lib/stellar-network";
import { StellarWalletsKit } from "@/lib/wallet/kit";

export interface SignStepResult {
	txHash: string;
	// "pending": Go's 202 — the RPC timed out, the outcome is unknown, not failed.
	status: "succeeded" | "pending";
}

export interface SignStepProps {
	unsignedXdr: string;
	address: string;
	// The server action that hands the signed envelope to Go's /submit.
	onSigned: (signedXdr: string) => Promise<SignStepResult>;
	label?: string;
}

type Phase =
	| { kind: "idle" }
	| { kind: "signing" }
	| { kind: "submitting" }
	| { kind: "confirmed"; txHash: string; status: SignStepResult["status"] }
	| { kind: "failed"; message: string };

// One signing step, reused by every screen that signs (issue #15, decision
// 5): the server built the XDR, the wallet signs it here, the server submits
// it. No optimistic state — nothing reads as done until Go returns a hash.
export function SignStep({
	unsignedXdr,
	address,
	onSigned,
	label,
}: SignStepProps) {
	const t = useTranslations("SignStep");
	const [phase, setPhase] = useState<Phase>({ kind: "idle" });

	async function sign() {
		setPhase({ kind: "signing" });
		let signedTxXdr: string;
		try {
			// The passphrase is passed explicitly: a wallet defaulting to the
			// wrong network fails at submit with an opaque error.
			const res = await StellarWalletsKit.signTransaction(unsignedXdr, {
				address,
				networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
			});
			signedTxXdr = res.signedTxXdr;
		} catch (err) {
			setPhase({ kind: "failed", message: describe(err, t("signRejected")) });
			return;
		}

		setPhase({ kind: "submitting" });
		try {
			const result = await onSigned(signedTxXdr);
			setPhase({ kind: "confirmed", ...result });
		} catch (err) {
			setPhase({ kind: "failed", message: describe(err, t("submitFailed")) });
		}
	}

	const busy = phase.kind === "signing" || phase.kind === "submitting";

	return (
		<div className="flex flex-col gap-3">
			{phase.kind !== "confirmed" && (
				<Button onClick={sign} disabled={busy} className="w-full sm:w-auto">
					{phase.kind === "signing"
						? t("signing")
						: phase.kind === "submitting"
							? t("submitting")
							: phase.kind === "failed"
								? t("retry")
								: (label ?? t("sign"))}
				</Button>
			)}

			{phase.kind === "confirmed" && (
				<div
					className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"
					role="status"
				>
					<p className="font-medium text-emerald-300">
						{phase.status === "pending" ? t("pending") : t("confirmed")}
					</p>
					<div className="mt-1 break-all">
						<TxHashLink
							hash={phase.txHash}
							network={STELLAR_NETWORK}
							leadingChars={8}
							trailingChars={8}
						/>
					</div>
				</div>
			)}

			{phase.kind === "failed" && (
				<p
					className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 break-words"
					role="alert"
				>
					{phase.message}
				</p>
			)}
		</div>
	);
}

function describe(err: unknown, fallback: string): string {
	if (err instanceof Error && err.message) return err.message;
	if (typeof err === "string" && err) return err;
	if (typeof err === "object" && err !== null && "message" in err) {
		const m = (err as { message: unknown }).message;
		if (typeof m === "string" && m) return m;
	}
	return fallback;
}
