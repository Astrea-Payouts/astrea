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
		<main className="min-h-screen bg-black text-white pt-28 pb-16 px-4 sm:px-6 md:py-12 md:px-12">
			<div className="mx-auto max-w-2xl flex flex-col gap-6">
				<header className="flex flex-col gap-3">
					<EventStatusBadge status={event.status} className="w-fit" />
					<h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
						{title}
					</h1>
					<Link
						href={`/events/${event.id}`}
						className="text-sm text-zinc-400 underline-offset-4 hover:underline break-words"
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
			className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 break-words"
		>
			{label}{" "}
			<span className="font-mono text-xs">
				{failure.code}
				{failure.message ? ` — ${failure.message}` : ""}
			</span>
		</p>
	);
}
