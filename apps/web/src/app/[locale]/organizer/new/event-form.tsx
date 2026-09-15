"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { type CreateDraftResult, createDraftEventAction } from "./actions";

const inputClass =
	"w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none";

export interface EventFormProps {
	organizerAddress: string;
	symbol: string;
}

// datetime-local carries no zone: the browser's zone is what the organizer
// meant, so the instant is converted here and posted as ISO (UTC) together
// with the zone name. The server never guesses a timezone.
function toIso(local: string): string {
	if (!local) return "";
	const ms = new Date(local).getTime();
	return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
}

function browserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}

export function EventForm({ organizerAddress, symbol }: EventFormProps) {
	const t = useTranslations("OrganizerNew");
	const [state, action, pending] = useActionState(createDraftEventAction, null);
	const [prizes, setPrizes] = useState<string[]>([""]);
	const [deadlineLocal, setDeadlineLocal] = useState("");

	function setPrize(i: number, value: string) {
		setPrizes((prev) => prev.map((p, j) => (j === i ? value : p)));
	}

	return (
		<form action={action} className="flex flex-col gap-6">
			<input type="hidden" name="timezone" value={browserTimezone()} />

			<label className="flex flex-col gap-1 text-sm text-zinc-300">
				{t("name")}
				<input
					name="name"
					required
					maxLength={120}
					className={inputClass}
					autoComplete="off"
				/>
			</label>

			<label className="flex flex-col gap-1 text-sm text-zinc-300">
				{t("description")}
				<textarea
					name="description"
					rows={3}
					maxLength={2000}
					className={inputClass}
				/>
			</label>

			<fieldset className="flex flex-col gap-2">
				<legend className="text-sm text-zinc-300">
					{t("prizes", { symbol })}
				</legend>
				<p className="text-xs text-zinc-500">{t("prizesHint")}</p>
				{prizes.map((value, i) => (
					<div
						// Rows are positional (rank = index + 1); no stable id exists.
						// biome-ignore lint/suspicious/noArrayIndexKey: positional rows
						key={i}
						className="flex items-center gap-2"
					>
						<span className="w-8 shrink-0 font-mono text-xs text-zinc-400">
							#{i + 1}
						</span>
						<input
							name="prize"
							aria-label={t("prizeAmount", { rank: i + 1 })}
							inputMode="decimal"
							required
							pattern="\d+(\.\d{1,7})?"
							placeholder="0.0000000"
							value={value}
							onChange={(e) => setPrize(i, e.target.value)}
							className={inputClass}
						/>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							aria-label={t("removePrize", { rank: i + 1 })}
							disabled={prizes.length === 1}
							onClick={() =>
								setPrizes((prev) => prev.filter((_, j) => j !== i))
							}
						>
							−
						</Button>
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-fit"
					onClick={() => setPrizes((prev) => [...prev, ""])}
				>
					{t("addPrize")}
				</Button>
			</fieldset>

			<label className="flex flex-col gap-1 text-sm text-zinc-300">
				{t("judgeAddress")}
				<input
					name="judgeAddress"
					required
					pattern="G[A-Z2-7]{55}"
					className={`${inputClass} font-mono`}
					autoComplete="off"
					spellCheck={false}
				/>
				<span className="text-xs text-zinc-500">
					{t("judgeAddressHint", { organizer: organizerAddress })}
				</span>
			</label>

			<label className="flex flex-col gap-1 text-sm text-zinc-300">
				{t("judgeName")}
				<input
					name="judgeName"
					required
					maxLength={80}
					className={inputClass}
					autoComplete="off"
				/>
			</label>

			<label className="flex flex-col gap-1 text-sm text-zinc-300">
				{t("deadline")}
				<input
					type="datetime-local"
					required
					value={deadlineLocal}
					onChange={(e) => setDeadlineLocal(e.target.value)}
					className={inputClass}
				/>
				<input
					type="hidden"
					name="judgingDeadlineAt"
					value={toIso(deadlineLocal)}
				/>
				<span className="text-xs text-zinc-500">{t("deadlineHint")}</span>
			</label>

			<Button type="submit" disabled={pending} className="w-full sm:w-auto">
				{pending ? t("submitting") : t("submit")}
			</Button>

			<FormError result={state} />
		</form>
	);
}

function FormError({ result }: { result: CreateDraftResult | null }) {
	const t = useTranslations("OrganizerNew.errors");
	if (!result || result.ok) return null;
	return (
		<p
			role="alert"
			className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 break-words"
		>
			{t(result.code)}
			{result.detail ? (
				<>
					{" "}
					<code className="font-mono text-xs">{result.detail}</code>
				</>
			) : null}
		</p>
	);
}
