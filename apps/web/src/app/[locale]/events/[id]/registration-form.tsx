"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ActionError } from "@/components/events/action-error";
import { Button } from "@/components/ui/button";
import { registerTeamAction } from "./actions";

const inputClass =
	"w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none";

export function RegistrationForm({ eventId }: { eventId: string }) {
	const t = useTranslations("EventPage.register");
	const [state, action, pending] = useActionState(registerTeamAction, null);

	return (
		<form action={action} className="flex flex-col gap-3">
			<input type="hidden" name="eventId" value={eventId} />
			<label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
				{t("teamName")}
				<input
					name="teamName"
					required
					maxLength={80}
					className={inputClass}
					autoComplete="off"
				/>
			</label>
			<label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
				{t("submissionUrl")}
				<input
					name="submissionUrl"
					type="url"
					required
					placeholder="https://"
					className={inputClass}
					autoComplete="off"
				/>
			</label>
			<Button type="submit" disabled={pending} className="w-full sm:w-auto">
				{pending ? t("submitting") : t("submit")}
			</Button>
			<ActionError result={state} />
		</form>
	);
}
