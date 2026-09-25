"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SignStep, type SignStepResult } from "@/components/events/sign-step";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { formatSmallestUnits } from "@/lib/explorer";
import type { ActionFailure } from "../action-result";
import { readEventStatus } from "../actions";
import {
	alertClass,
	DepositStep,
	Failure,
	PendingPanel,
} from "../deposit-step";
import { buildCreate, readBalance, submitCreate } from "./actions";

export interface FundAndCreateProps {
	eventId: string;
	address: string;
	/** Stroops, from Go's /balance at render time. */
	initialBalance: string;
	/** Stroops, the page's sum of the Prize rows — display only. */
	required: string;
	symbol: string;
}

type CreateBuilt = {
	unsignedTransactionXdr: string;
	reward: string;
	escrowEventId: string;
};

// Two signing steps, both built by Go right before the wallet opens (its
// transactions carry a 60 s timebound) and both with nothing optimistic:
// the balance only moves when /balance says so, the event only exists when
// /create/submit returns a hash (issue #15, decision 5).
export function FundAndCreate({
	eventId,
	address,
	initialBalance,
	required,
	symbol,
}: FundAndCreateProps) {
	const t = useTranslations("FundPage");
	const router = useRouter();
	const [balance, setBalance] = useState(initialBalance);
	const [pending, startTransition] = useTransition();

	const shortfall = BigInt(required) - BigInt(balance);
	const needsDeposit = shortfall > BigInt(0);

	// Step 2 — create.
	const [createBuilt, setCreateBuilt] = useState<CreateBuilt | null>(null);
	const [createFailure, setCreateFailure] = useState<ActionFailure | null>(
		null,
	);
	const [createPending, setCreatePending] = useState<string | null>(null);

	// Step 1 — deposit: the balance is what decides whether it is done.
	async function refreshBalance(): Promise<ActionFailure | null> {
		const res = await readBalance(address);
		if (!res.ok) return res;
		setBalance(res.balance);
		return null;
	}

	function startCreate() {
		setCreateFailure(null);
		setCreateBuilt(null);
		setCreatePending(null);
		startTransition(async () => {
			const res = await buildCreate(eventId);
			if (res.ok) {
				setCreateBuilt({
					unsignedTransactionXdr: res.unsignedTransactionXdr,
					reward: res.reward,
					escrowEventId: res.escrowEventId,
				});
			} else {
				setCreateFailure(res);
			}
		});
	}

	// SignStep expects a thrown error on failure; the actions return Go's
	// envelope instead, so it is rethrown here with the verbatim message.
	async function onCreateSigned(signedXdr: string): Promise<SignStepResult> {
		const res = await submitCreate(eventId, signedXdr);
		if (!res.ok) {
			setCreateFailure(res);
			throw new Error(res.message || res.code);
		}
		setCreateFailure(null);
		if (res.status === "succeeded") {
			router.push(`/events/${eventId}`);
		} else {
			setCreatePending(res.txHash);
		}
		return { txHash: res.txHash, status: res.status };
	}

	function checkCreate() {
		startTransition(async () => {
			const res = await readEventStatus(eventId);
			if (!res.ok) {
				setCreateFailure(res);
				return;
			}
			if (res.status === "CREATED") router.push(`/events/${eventId}`);
		});
	}

	// Go's reward is authoritative; a mismatch with the page's own sum is a
	// rounding bug on one side and must not be signed over.
	const rewardMismatch =
		createBuilt !== null && createBuilt.reward !== required;

	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-zinc-900/60">
				<dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
					<dt className="text-zinc-600 dark:text-zinc-400">{t("balance")}</dt>
					<dd className="font-mono" data-testid="balance">
						{formatSmallestUnits(balance)} {symbol}
					</dd>
					<dt className="text-zinc-600 dark:text-zinc-400">{t("required")}</dt>
					<dd className="font-mono">
						{formatSmallestUnits(required)} {symbol}
					</dd>
				</dl>
			</section>

			{needsDeposit ? (
				<DepositStep
					address={address}
					symbol={symbol}
					shortfall={shortfall.toString()}
					onDeposited={refreshBalance}
				/>
			) : (
				<section
					aria-labelledby="create-title"
					className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-5 dark:border-white/10"
				>
					<h2 id="create-title" className="text-lg font-bold">
						{t("create.title")}
					</h2>
					<p className="text-sm text-zinc-600 dark:text-zinc-400">
						{t("create.hint")}
					</p>

					{!createBuilt && !createPending ? (
						<Button
							onClick={startCreate}
							disabled={pending}
							className="w-full sm:w-auto"
						>
							{pending
								? t("create.building")
								: t("create.build", {
										amount: formatSmallestUnits(required),
										symbol,
									})}
						</Button>
					) : null}

					{createBuilt && !createPending ? (
						<div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-zinc-900/60">
							<dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
								<dt className="text-zinc-600 dark:text-zinc-400">
									{t("create.reward")}
								</dt>
								<dd className="font-mono" data-testid="reward">
									{formatSmallestUnits(createBuilt.reward)} {symbol}
								</dd>
								<dt className="text-zinc-600 dark:text-zinc-400">
									{t("create.escrowEventId")}
								</dt>
								<dd className="font-mono text-xs break-all">
									{createBuilt.escrowEventId}
								</dd>
							</dl>
							{rewardMismatch ? (
								<p role="alert" className={alertClass}>
									{t("create.rewardMismatch", {
										go: formatSmallestUnits(createBuilt.reward),
										page: formatSmallestUnits(required),
										symbol,
									})}
								</p>
							) : (
								<>
									<p className="text-xs text-zinc-600 dark:text-zinc-400">
										{t("create.signHint")}
									</p>
									<SignStep
										unsignedXdr={createBuilt.unsignedTransactionXdr}
										address={address}
										onSigned={onCreateSigned}
										label={t("create.sign")}
									/>
								</>
							)}
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setCreateBuilt(null)}
								className="w-fit"
							>
								{t("create.discard")}
							</Button>
						</div>
					) : null}

					{createPending ? (
						<PendingPanel
							title={t("create.pending")}
							hash={createPending}
							checkLabel={pending ? t("checking") : t("checkAgain")}
							onCheck={checkCreate}
							disabled={pending}
						/>
					) : null}

					{/* create_build_replaced gets its own copy: retrying would move money twice. */}
					{createFailure?.code === "create_build_replaced" ? (
						<p role="alert" className={alertClass}>
							{t("create.buildReplaced", { hash: createFailure.txHash ?? "—" })}
						</p>
					) : (
						<Failure failure={createFailure} />
					)}
				</section>
			)}
		</div>
	);
}
