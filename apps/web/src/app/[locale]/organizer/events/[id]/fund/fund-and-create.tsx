"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SignStep, type SignStepResult } from "@/components/events/sign-step";
import { TxHashLink } from "@/components/tx-hash-link";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { parseUsdcAmount } from "@/lib/escrow/amount";
import { formatSmallestUnits } from "@/lib/explorer";
import { STELLAR_NETWORK } from "@/lib/stellar-network";
import {
	buildCreate,
	buildDeposit,
	type FundFailure,
	readBalance,
	readEventStatus,
	submitCreate,
	submitDeposit,
} from "./actions";

export interface FundAndCreateProps {
	eventId: string;
	address: string;
	/** Stroops, from Go's /balance at render time. */
	initialBalance: string;
	/** Stroops, the page's sum of the Prize rows — display only. */
	required: string;
	symbol: string;
}

type DepositBuilt = { opId: string; unsignedTransactionXdr: string };
type CreateBuilt = {
	unsignedTransactionXdr: string;
	reward: string;
	escrowEventId: string;
};

const inputClass =
	"w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none";
const alertClass =
	"rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 break-words";

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

	const requiredN = BigInt(required);
	const shortfall = requiredN - BigInt(balance);
	const needsDeposit = shortfall > BigInt(0);

	// Step 1 — deposit.
	const [amount, setAmount] = useState(
		needsDeposit ? formatSmallestUnits(shortfall.toString()) : "",
	);
	const [depositBuilt, setDepositBuilt] = useState<DepositBuilt | null>(null);
	const [depositFailure, setDepositFailure] = useState<FundFailure | null>(
		null,
	);
	const [depositPending, setDepositPending] = useState<string | null>(null);

	// Step 2 — create.
	const [createBuilt, setCreateBuilt] = useState<CreateBuilt | null>(null);
	const [createFailure, setCreateFailure] = useState<FundFailure | null>(null);
	const [createPending, setCreatePending] = useState<string | null>(null);

	const amountStroops = parseUsdcAmount(amount);
	const amountOk = amountStroops !== null && amountStroops >= shortfall;

	async function refreshBalance(): Promise<string | null> {
		const res = await readBalance(address);
		if (!res.ok) {
			setDepositFailure(res);
			return null;
		}
		setBalance(res.balance);
		return res.balance;
	}

	function startDeposit() {
		setDepositFailure(null);
		setDepositBuilt(null);
		setDepositPending(null);
		startTransition(async () => {
			const res = await buildDeposit(address, amount);
			if (res.ok) {
				setDepositBuilt({
					opId: res.opId,
					unsignedTransactionXdr: res.unsignedTransactionXdr,
				});
			} else {
				setDepositFailure(res);
			}
		});
	}

	// SignStep expects a thrown error on failure; the actions return Go's
	// envelope instead, so it is rethrown here with the verbatim message.
	async function onDepositSigned(signedXdr: string): Promise<SignStepResult> {
		if (!depositBuilt) throw new Error("no deposit built");
		const res = await submitDeposit(address, depositBuilt.opId, signedXdr);
		if (!res.ok) {
			setDepositFailure(res);
			throw new Error(res.message || res.code);
		}
		setDepositFailure(null);
		if (res.status === "succeeded") {
			// 200: the deposit landed; re-read the balance and let the
			// derived `needsDeposit` decide whether step 1 is done.
			await refreshBalance();
			setDepositBuilt(null);
		} else {
			setDepositPending(res.txHash);
		}
		return { txHash: res.txHash, status: res.status };
	}

	function checkDeposit() {
		startTransition(async () => {
			const next = await refreshBalance();
			if (next !== null && BigInt(next) >= requiredN) {
				setDepositPending(null);
				setDepositBuilt(null);
			}
		});
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

	const shortfallText = formatSmallestUnits(shortfall.toString());

	return (
		<div className="flex flex-col gap-6">
			<section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 flex flex-col gap-3">
				<dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
					<dt className="text-zinc-400">{t("balance")}</dt>
					<dd className="font-mono" data-testid="balance">
						{formatSmallestUnits(balance)} {symbol}
					</dd>
					<dt className="text-zinc-400">{t("required")}</dt>
					<dd className="font-mono">
						{formatSmallestUnits(required)} {symbol}
					</dd>
				</dl>
			</section>

			{needsDeposit ? (
				<section
					aria-labelledby="deposit-title"
					className="rounded-2xl border border-white/10 p-5 flex flex-col gap-3"
				>
					<h2 id="deposit-title" className="text-lg font-bold">
						{t("deposit.title")}
					</h2>
					<p className="text-sm text-zinc-400">
						{t("deposit.hint", { shortfall: shortfallText, symbol })}
					</p>

					{!depositBuilt && !depositPending ? (
						<>
							<label className="flex flex-col gap-1 text-sm text-zinc-300">
								{t("deposit.amount", { symbol })}
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
									{t("deposit.belowShortfall", {
										shortfall: shortfallText,
										symbol,
									})}
								</p>
							) : null}
							<Button
								onClick={startDeposit}
								disabled={!amountOk || pending}
								className="w-full sm:w-auto"
							>
								{pending
									? t("deposit.building")
									: t("deposit.build", {
											amount:
												amountStroops !== null
													? formatSmallestUnits(amountStroops.toString())
													: amount,
											symbol,
										})}
							</Button>
						</>
					) : null}

					{depositBuilt && !depositPending ? (
						<>
							<p className="text-xs text-zinc-400">{t("deposit.signHint")}</p>
							<SignStep
								unsignedXdr={depositBuilt.unsignedTransactionXdr}
								address={address}
								onSigned={onDepositSigned}
								label={t("deposit.sign")}
							/>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setDepositBuilt(null)}
								className="w-fit"
							>
								{t("deposit.changeAmount")}
							</Button>
						</>
					) : null}

					{depositPending ? (
						<PendingPanel
							title={t("deposit.pending")}
							hash={depositPending}
							checkLabel={pending ? t("checking") : t("checkAgain")}
							onCheck={checkDeposit}
							disabled={pending}
						/>
					) : null}

					<Failure failure={depositFailure} />
				</section>
			) : (
				<section
					aria-labelledby="create-title"
					className="rounded-2xl border border-white/10 p-5 flex flex-col gap-3"
				>
					<h2 id="create-title" className="text-lg font-bold">
						{t("create.title")}
					</h2>
					<p className="text-sm text-zinc-400">{t("create.hint")}</p>

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
						<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 flex flex-col gap-3">
							<dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
								<dt className="text-zinc-400">{t("create.reward")}</dt>
								<dd className="font-mono" data-testid="reward">
									{formatSmallestUnits(createBuilt.reward)} {symbol}
								</dd>
								<dt className="text-zinc-400">{t("create.escrowEventId")}</dt>
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
									<p className="text-xs text-zinc-400">
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

					<Failure failure={createFailure} />
				</section>
			)}
		</div>
	);
}

function PendingPanel({
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

// Go's code and message verbatim; `create_build_replaced` gets its own copy
// because retrying would move money twice.
function Failure({ failure }: { failure: FundFailure | null }) {
	const t = useTranslations("FundPage");
	if (!failure) return null;
	if (failure.code === "create_build_replaced") {
		return (
			<p role="alert" className={alertClass}>
				{t("create.buildReplaced", { hash: failure.txHash ?? "—" })}
			</p>
		);
	}
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
