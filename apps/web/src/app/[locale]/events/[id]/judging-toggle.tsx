"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ActionError } from "@/components/events/action-error";
import { Button } from "@/components/ui/button";
import { startJudgingAction } from "./actions";

export function JudgingToggle({ eventId }: { eventId: string }) {
	const t = useTranslations("EventPage.organizer");
	const [state, action, pending] = useActionState(startJudgingAction, null);

	return (
		<form action={action} className="flex flex-col gap-3">
			<input type="hidden" name="eventId" value={eventId} />
			<p className="text-sm text-zinc-400">{t("closeHint")}</p>
			<Button
				type="submit"
				variant="outline"
				disabled={pending}
				className="w-full sm:w-auto"
			>
				{pending ? t("closing") : t("close")}
			</Button>
			<ActionError result={state} />
		</form>
	);
}
