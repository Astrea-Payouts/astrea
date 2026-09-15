"use client";

import { useTranslations } from "next-intl";
import type { ActionResult } from "@/app/[locale]/events/[id]/actions";

// Renders a refused ActionResult in the viewer's locale; `detail` (a
// trustline, a transition error) is appended verbatim.
export function ActionError({ result }: { result: ActionResult | null }) {
	const t = useTranslations("EventPage.errors");
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
