"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SignStep, type SignStepResult } from "@/components/events/sign-step";
import { TxHashLink } from "@/components/tx-hash-link";
import { Button } from "@/components/ui/button";
import { parseUsdcAmount } from "@/lib/escrow/amount";
import { formatSmallestUnits } from "@/lib/explorer";
import { STELLAR_NETWORK } from "@/lib/stellar-network";
import type { ActionFailure } from "./action-result";
import { buildDeposit, submitDeposit } from "./actions";

export interface DepositStepProps {
	address: string;
	symbol: string;
	/** Stroops the escrow balance is short by; prefills the amount and is the minimum accepted. */
	shortfall: string;
	/**
	 * After a confirmed deposit, and on "Check again" after a 202: the screen
	 * re-reads whatever it derives `shortfall` from (/fund the balance, /start
	 * the quote) and unmounts this step once it is covered. Resolves to that
	 * read's failure, if any, so it shows under the step.
	 */
	onDeposited: () => Promise<ActionFailure | null>;
}

type DepositBuilt = { opId: string; unsignedTransactionXdr: string };

export const inputClass =
	"w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none";
export const alertClass =
	"rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 break-words";

// The organizer's wallet tops up its USDC balance in the escrow contract —
// step 1 of /fund (for the reserve) and the shortfall branch of /start (for
// the go-live fee). Built by Go right before the wallet opens (60 s
// timebound), nothing optimistic: the step only goes away when the screen's
// own re-read says the shortfall is covered.
export function DepositStep({
	address,
	symbol,
	shortfall,
	onDeposited,
}: DepositStepProps) {
	const t = useTranslations("DepositStep");
	const [pending, startTransition] = useTransition();
	const shortfallN = BigInt(shortfall);
	const [amount, setAmount] = useState(formatSmallestUnits(shortfall));
	const [built, setBuilt] = useState<DepositBuilt | null>(null);
	const [failure, setFailure] = useState<ActionFailure | null>(null);
	const [pendingHash, setPendingHash] = useState<string | null>(null);

	const amountStroops = parseUsdcAmount(amount);
	const amountOk = amountStroops !== null && amountStroops >= shortfallN;

	function start() {
		setFailure(null);
		setBuilt(null);
		setPendingHash(null);
		startTransition(async () => {
			const res = await buildDeposit(address, amount);
			if (res.ok) {
				setBuilt({
					opId: res.opId,
					unsignedTransactionXdr: res.unsignedTransactionXdr,
				});
			} else {
				setFailure(res);
			}
		});
	}

	// SignStep expects a thrown error on failure; the actions return Go's
	// envelope instead, so it is rethrown here with the verbatim message.
	async function onSigned(signedXdr: string): Promise<SignStepResult> {
		if (!built) throw new Error("no deposit built");
		const res = await submitDeposit(address, built.opId, signedXdr);
		if (!res.ok) {
			setFailure(res);
			throw new Error(res.message || res.code);
		}
		setFailure(null);
		if (res.status === "succeeded") {
			// 200: the deposit landed; the screen re-reads and decides whether
			// this step is done.
			setFailure(await onDeposited());
			setBuilt(null);
		} else {
			setPendingHash(res.txHash);
		}
		return { txHash: res.txHash, status: res.status };
	}

	function check() {
		startTransition(async () => {
			setFailure(await onDeposited());
		});
	}

	const shortfallText = formatSmallestUnits(shortfall);

	return (
		<section
			aria-labelledby="deposit-title"
			className="rounded-2xl border border-white/10 p-5 flex flex-col gap-3"
		>
			<h2 id="deposit-title" className="text-lg font-bold">
				{t("title")}
			</h2>
			<p className="text-sm text-zinc-400">
				{t("hint", { shortfall: shortfallText, symbol })}
			</p>

			{!built && !pendingHash ? (
				<>
					<label className="flex flex-col gap-1 text-sm text-zinc-300">
						{t("amount", { symbol })}
						<input
							name="amount"
							inputMode="decimal"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className={`${inputClass} font-mono`}
						/>
					</label>
					{!amountOk ? (
						<p className="text-xs text-amber-300">
							{t("belowShortfall", { shortfall: shortfallText, symbol })}
						</p>
					) : null}
					<Button
						onClick={start}
						disabled={!amountOk || pending}
						className="w-full sm:w-auto"
					>
						{pending
							? t("building")
							: t("build", {
									amount:
										amountStroops !== null
											? formatSmallestUnits(amountStroops.toString())
											: amount,
									symbol,
								})}
					</Button>
				</>
			) : null}

			{built && !pendingHash ? (
				<>
					<p className="text-xs text-zinc-400">{t("signHint")}</p>
					<SignStep
						unsignedXdr={built.unsignedTransactionXdr}
						address={address}
						onSigned={onSigned}
						label={t("sign")}
					/>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setBuilt(null)}
						className="w-fit"
					>
						{t("changeAmount")}
					</Button>
				</>
			) : null}

			{pendingHash ? (
				<PendingPanel
					title={t("pending")}
					hash={pendingHash}
					checkLabel={pending ? t("checking") : t("checkAgain")}
					onCheck={check}
					disabled={pending}
				/>
			) : null}

			<Failure failure={failure} />
		</section>
	);
}

// Go's 202: the hash to look up, and a button that re-reads instead of
// polling.
export function PendingPanel({
	title,
	hash,
	checkLabel,
	onCheck,
	disabled,
}: {
	title: string;
	hash: string;
	checkLabel: string;
	onCheck: () => void;
	disabled: boolean;
}) {
	return (
		<div
			className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col gap-2"
			role="status"
		>
			<p className="font-semibold text-amber-300">{title}</p>
			<div className="break-all">
				<TxHashLink
					hash={hash}
					network={STELLAR_NETWORK}
					leadingChars={10}
					trailingChars={10}
				/>
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={onCheck}
				disabled={disabled}
				className="w-fit"
			>
				{checkLabel}
			</Button>
		</div>
	);
}

// Go's code and message verbatim. Codes that need their own copy
// (*_build_replaced, deadline_*) are rendered by the screen instead.
export function Failure({ failure }: { failure: ActionFailure | null }) {
	if (!failure) return null;
	return (
		<p role="alert" className={alertClass}>
			<span className="font-mono text-xs">
				{failure.status ? `${failure.status} ` : ""}
				{failure.code}
			</span>
			{failure.message ? ` — ${failure.message}` : null}
		</p>
	);
}
