import { EventStatusBadge } from "@/components/events/status-badge";
import type { EventStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";

// The frame every organizer screen for one event shares (/fund, /start):
// status badge, title, link back to the public page.
export function OrganizerShell({
	title,
	event,
	children,
}: {
	title: string;
	event: { id: string; name: string; status: EventStatus };
	children: React.ReactNode;
}) {
	return (
		<main className="min-h-screen bg-white px-4 pt-28 pb-16 text-zinc-950 sm:px-6 md:px-12 md:py-12 dark:bg-black dark:text-white">
			<div className="mx-auto flex max-w-2xl flex-col gap-6">
				<header className="flex flex-col gap-3">
					<EventStatusBadge status={event.status} className="w-fit" />
					<h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
						{title}
					</h1>
					<Link
						href={`/events/${event.id}`}
						className="text-sm break-words text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
					>
						{event.name}
					</Link>
				</header>
				{children}
			</div>
		</main>
	);
}

// The server-side read Go answers before the client component can mount
// (/balance, /start/quote) failed: the label says which, the code and
// message are Go's verbatim.
export function ServiceFailure({
	label,
	failure,
}: {
	label: string;
	failure: { code: string; message: string };
}) {
	return (
		<p
			role="alert"
			className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm break-words text-red-700 dark:text-red-300"
		>
			{label}{" "}
			<span className="font-mono text-xs">
				{failure.code}
				{failure.message ? ` — ${failure.message}` : ""}
			</span>
		</p>
	);
}
