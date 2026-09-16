"use client";

import { useLocale, useTranslations } from "next-intl";
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
import { buildStart, readQuote, submitStart } from "./actions";

export interface Quote {
	fee: string;
	balance: string;
	shortfall: string;
}

export interface GoLiveProps {
	eventId: string;
	address: string;
	/** Stroops, from Go's /start/quote at render time. */
	initialQuote: Quote;
	/** Event.judgingDeadlineAt formatted by the page in the event's timezone; null when unset. */
	judgingDeadline: string | null;
	/** IANA zone the organizer picked; the built deadline is shown in it too. */
	timezone: string;
	symbol: string;
}

type StartBuilt = {
	unsignedTransactionXdr: string;
	judgingDeadline: number;
	fee: string;
};

type Submitted = { txHash: string; status: "succeeded" | "pending" };

const DEADLINE_CODES = new Set(["deadline_missing", "deadline_past"]);

// Mirrors /fund: the quote decides whether the deposit step shows, the
// go-live transaction is built by Go right before the wallet opens (60 s
// timebound), and nothing reads as done until readEventStatus says LIVE —
// Go is the only writer of that status (issue #11, decision 6).
export function GoLive({
	eventId,
	address,
	initialQuote,
	judgingDeadline,
	timezone,
	symbol,
}: GoLiveProps) {
	const t = useTranslations("GoLivePage");
	const locale = useLocale();
	const router = useRouter();
	const [quote, setQuote] = useState(initialQuote);
	const [pending, startTransition] = useTransition();

	const needsDeposit = BigInt(quote.shortfall) > BigInt(0);

	const [built, setBuilt] = useState<StartBuilt | null>(null);
	const [failure, setFailure] = useState<ActionFailure | null>(null);
	const [submitted, setSubmitted] = useState<Submitted | null>(null);

	// The quote is this screen's single source: after a deposit, on "Check
	// again", and when Go refuses a build for insufficient_balance.
	async function refreshQuote(): Promise<ActionFailure | null> {
		const res = await readQuote(eventId);
		if (!res.ok) return res;
		setQuote({ fee: res.fee, balance: res.balance, shortfall: res.shortfall });
		return null;
	}

	// True when the event now reads LIVE (and the redirect is on its way).
	async function checkLive(): Promise<boolean> {
		const res = await readEventStatus(eventId);
		if (!res.ok) {
			setFailure(res);
			return false;
		}
		if (res.status === "LIVE") {
			router.push(`/events/${eventId}`);
			return true;
		}
		return false;
	}

	// Every refusal Go can answer with, by code (issue #15 B2).
	async function handleFailure(f: ActionFailure) {
		switch (f.code) {
			case "insufficient_balance": {
				setBuilt(null);
				const quoteFailure = await refreshQuote();
				setFailure(quoteFailure ?? f);
				return;
			}
			case "event_not_created":
			case "start_already_succeeded": {
				setBuilt(null);
				if (!(await checkLive())) setFailure(f);
				return;
			}
			case "no_pending_start":
			case "start_build_replaced":
				// Both need a fresh build; the organizer presses Go live again.
				setBuilt(null);
				setFailure(f);
				return;
			default:
				setFailure(f);
		}
	}

	function start() {
		setFailure(null);
		setBuilt(null);
		setSubmitted(null);
		startTransition(async () => {
			const res = await buildStart(eventId);
			if (res.ok) {
				setBuilt({
					unsignedTransactionXdr: res.unsignedTransactionXdr,
					judgingDeadline: res.judgingDeadline,
					fee: res.fee,
				});
			} else {
				await handleFailure(res);
			}
		});
	}

	// SignStep expects a thrown error on failure; the actions return Go's
	// envelope instead, so it is rethrown here with the verbatim message.
	async function onSigned(signedXdr: string): Promise<SignStepResult> {
		const res = await submitStart(eventId, signedXdr);
		if (!res.ok) {
			await handleFailure(res);
			throw new Error(res.message || res.code);
		}
		setFailure(null);
		setSubmitted({ txHash: res.txHash, status: res.status });
		// 200: Go wrote LIVE in the same transaction; one read confirms it.
		// 202: outcome unknown, the organizer clicks "Check again".
		if (res.status === "succeeded") await checkLive();
		return { txHash: res.txHash, status: res.status };
	}

	function check() {
		startTransition(async () => {
			await checkLive();
		});
	}

	const deadlineBlocked = failure !== null && DEADLINE_CODES.has(failure.code);
	const deadlineText = judgingDeadline ?? t("deadlineUnset");

	return (
		<div className="flex flex-col gap-6">
			<section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 flex flex-col gap-3">
				<dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
					<dt className="text-zinc-400">{t("fee")}</dt>
					<dd className="font-mono" data-testid="fee">
						{formatSmallestUnits(quote.fee)} {symbol}
					</dd>
					<dt className="text-zinc-400">{t("balance")}</dt>
					<dd className="font-mono" data-testid="balance">
						{formatSmallestUnits(quote.balance)} {symbol}
					</dd>
					<dt className="text-zinc-400">{t("shortfall")}</dt>
					<dd className="font-mono" data-testid="shortfall">
						{formatSmallestUnits(quote.shortfall)} {symbol}
					</dd>
					<dt className="text-zinc-400">{t("deadline")}</dt>
					<dd>{deadlineText}</dd>
				</dl>
				<p className="text-xs text-zinc-400">{t("feeHint")}</p>
			</section>

			{needsDeposit ? (
				<DepositStep
					address={address}
					symbol={symbol}
					shortfall={quote.shortfall}
					onDeposited={refreshQuote}
				/>
			) : (
				<section
					aria-labelledby="start-title"
					className="rounded-2xl border border-white/10 p-5 flex flex-col gap-3"
				>
					<h2 id="start-title" className="text-lg font-bold">
						{t("start.title")}
					</h2>
					<p className="text-sm text-zinc-400">{t("start.hint")}</p>

					{!built && !submitted && !deadlineBlocked ? (
						<Button
							onClick={start}
							disabled={pending}
							className="w-full sm:w-auto"
						>
							{pending ? t("start.building") : t("start.build")}
						</Button>
					) : null}

					{built && !submitted ? (
						<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 flex flex-col gap-3">
							<dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
								<dt className="text-zinc-400">{t("start.fee")}</dt>
								<dd className="font-mono" data-testid="built-fee">
									{formatSmallestUnits(built.fee)} {symbol}
								</dd>
								<dt className="text-zinc-400">{t("start.deadline")}</dt>
								<dd data-testid="built-deadline">
									{/* Go's unix seconds, in the same zone and style as the quote
									    above. Client-only (after a click), so no hydration concern. */}
									{new Intl.DateTimeFormat(locale, {
										dateStyle: "medium",
										timeStyle: "short",
										timeZone: timezone,
									}).format(new Date(built.judgingDeadline * 1000))}
								</dd>
							</dl>
							<p className="text-xs text-zinc-400">{t("start.signHint")}</p>
							<SignStep
								unsignedXdr={built.unsignedTransactionXdr}
								address={address}
								onSigned={onSigned}
								label={t("start.sign")}
							/>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setBuilt(null)}
								className="w-fit"
							>
								{t("start.discard")}
							</Button>
						</div>
					) : null}

					{submitted ? (
						<PendingPanel
							title={
								submitted.status === "pending"
									? t("start.pending")
									: t("start.confirmed")
							}
							hash={submitted.txHash}
							checkLabel={pending ? t("checking") : t("checkAgain")}
							onCheck={check}
							disabled={pending}
						/>
					) : null}

					<StartFailure failure={failure} deadline={deadlineText} />
				</section>
			)}
		</div>
	);
}

// The codes with their own copy; everything else is Go's code and message
// verbatim.
function StartFailure({
	failure,
	deadline,
}: {
	failure: ActionFailure | null;
	deadline: string;
}) {
	const t = useTranslations("GoLivePage.start");
	if (!failure) return null;
	switch (failure.code) {
		case "start_build_replaced":
			return (
				<p role="alert" className={alertClass}>
					{t("buildReplaced", { hash: failure.txHash ?? "—" })}
				</p>
			);
		case "deadline_missing":
			return (
				<p role="alert" className={alertClass}>
					{t("deadlineMissing")}
				</p>
			);
		case "deadline_past":
			return (
				<p role="alert" className={alertClass}>
					{t("deadlinePast", { deadline })}
				</p>
			);
		default:
			return <Failure failure={failure} />;
	}
}
