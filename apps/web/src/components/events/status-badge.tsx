import { useTranslations } from "next-intl";
import type { EventStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const STYLES: Record<EventStatus, string> = {
	DRAFT: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
	CREATED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
	FUNDED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
	LIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
	JUDGING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
	COMPLETED: "border-violet-500/30 bg-violet-500/10 text-violet-300",
	DISPUTED: "border-red-500/30 bg-red-500/10 text-red-300",
	CANCELLED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

export function EventStatusBadge({
	status,
	className,
}: {
	status: EventStatus;
	className?: string;
}) {
	const t = useTranslations("EventStatus");
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
				STYLES[status],
				className,
			)}
		>
			{t(status)}
		</span>
	);
}
