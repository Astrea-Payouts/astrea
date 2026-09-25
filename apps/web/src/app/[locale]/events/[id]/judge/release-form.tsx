"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SignStep, type SignStepResult } from "@/components/events/sign-step";
import { TxHashLink } from "@/components/tx-hash-link";
import { Button } from "@/components/ui/button";
import type { ReleaseWinner } from "@/lib/core-go/types";
import { STELLAR_NETWORK } from "@/lib/stellar-network";
import { buildRelease, type ReleaseFailure, submitRelease } from "./actions";

export interface ReleaseFormProps {
	eventId: string;
	judgeAddress: string;
	prizes: Array<{ rank: number; amount: string }>;
	teams: Array<{ id: string; name: string }>;
	symbol: string;
}

type Built = { unsignedTransactionXdr: string; winners: ReleaseWinner[] };

const selectClass =
	"w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-950 dark:text-white focus:border-emerald-500/50 focus:outline-none";

// Rank → team assignment, built by Go, signed by the judge's wallet, submitted
// by Go. The amounts shown are Postgres' Prize rows for orientation only;
// what gets paid is what the signed envelope carries, and Go refuses any
// envelope that differs from the one it built (409 envelope_mismatch).
export function ReleaseForm({
	eventId,
	judgeAddress,
	prizes,
	teams,
	symbol,
}: ReleaseFormProps) {
	const t = useTranslations("JudgePage");
	const [assignments, setAssignments] = useState<Record<number, string>>({});
	const [built, setBuilt] = useState<Built | null>(null);
	const [failure, setFailure] = useState<ReleaseFailure | null>(null);
	const [submitted, setSubmitted] = useState<SignStepResult | null>(null);
	const [pending, startTransition] = useTransition();

	const allAssigned = prizes.every((p) => assignments[p.rank]);
	const teamName = (id: string) =>
		teams.find((team) => team.id === id)?.name ?? id;

	function build() {
		setFailure(null);
		setBuilt(null);
		setSubmitted(null);
		startTransition(async () => {
			const res = await buildRelease(
				eventId,
				prizes.map((p) => ({ rank: p.rank, teamId: assignments[p.rank] })),
			);
			if (res.ok) {
				setBuilt({
					unsignedTransactionXdr: res.unsignedTransactionXdr,
					winners: res.winners,
				});
			} else {
				setFailure(res);
			}
		});
	}

	// SignStep expects a thrown error on failure so it can render "failed";
	// the action returns Go's envelope instead of throwing (see actions.ts),
	// so it is rethrown here with the verbatim message.
	async function onSigned(signedXdr: string): Promise<SignStepResult> {
		const res = await submitRelease(eventId, signedXdr);
		if (!res.ok) {
			setFailure(res);
			throw new Error(res.message || res.code);
		}
		setFailure(null);
		const result = { txHash: res.txHash, status: res.status };
		setSubmitted(result);
		return result;
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				{prizes.map((prize) => (
					<label
						key={prize.rank}
						className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300"
					>
						<span>
							{t("rank", { rank: prize.rank })}{" "}
							<span className="font-mono text-zinc-600 dark:text-zinc-400">
								{prize.amount} {symbol}
							</span>
						</span>
						<select
							name={`rank-${prize.rank}`}
							value={assignments[prize.rank] ?? ""}
							disabled={!!built || !!submitted}
							onChange={(e) =>
								setAssignments((prev) => ({
									...prev,
									[prize.rank]: e.target.value,
								}))
							}
							className={selectClass}
						>
							<option value="">{t("pickTeam")}</option>
							{teams.map((team) => (
								<option key={team.id} value={team.id}>
									{team.name}
								</option>
							))}
						</select>
					</label>
				))}
			</div>

			{!built && !submitted ? (
				<Button
					onClick={build}
					disabled={!allAssigned || pending || teams.length === 0}
					className="w-full sm:w-auto"
				>
					{pending ? t("building") : t("build")}
				</Button>
			) : null}

			{built ? (
				<div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-900/60 p-4 flex flex-col gap-3">
					<h2 className="text-sm font-semibold">{t("winnersTitle")}</h2>
					<WinnersList winners={built.winners} teamName={teamName} />
					{!submitted ? (
						<>
							<p className="text-xs text-zinc-600 dark:text-zinc-400">
								{t("signHint")}
							</p>
							<SignStep
								unsignedXdr={built.unsignedTransactionXdr}
								address={judgeAddress}
								onSigned={onSigned}
								label={t("sign")}
							/>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setBuilt(null)}
								className="w-fit"
							>
								{t("rebuild")}
							</Button>
						</>
					) : null}
				</div>
			) : null}

			{submitted ? (
				<div
					className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-2"
					role="status"
				>
					<p className="font-semibold text-emerald-700 dark:text-emerald-300">
						{submitted.status === "pending" ? t("pending") : t("released")}
					</p>
					<div className="break-all">
						<TxHashLink
							hash={submitted.txHash}
							network={STELLAR_NETWORK}
							leadingChars={10}
							trailingChars={10}
						/>
					</div>
				</div>
			) : null}

			{failure ? (
				<p
					role="alert"
					className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300 break-words"
				>
					<span className="font-mono text-xs">
						{failure.status ? `${failure.status} ` : ""}
						{failure.code}
					</span>
					{failure.message ? ` — ${failure.message}` : null}
				</p>
			) : null}
		</div>
	);
}

function WinnersList({
	winners,
	teamName,
}: {
	winners: ReleaseWinner[];
	teamName: (id: string) => string;
}) {
	return (
		<ul className="divide-y divide-zinc-200 dark:divide-white/10 text-sm">
			{winners.map((w) => (
				<li
					key={`${w.rank}-${w.teamMemberId}`}
					className="flex flex-col gap-0.5 py-2"
				>
					<span>
						#{w.rank} · {teamName(w.teamId)}
					</span>
					<span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 break-all">
						{w.address}
					</span>
				</li>
			))}
		</ul>
	);
}
