import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCancellationContext } from "@/app/[locale]/events/[id]/cancel/actions";
import { CancelEventAction } from "@/components/organizer/cancel-event-action";

interface PageProps {
	params: Promise<{
		locale: string;
		id: string;
	}>;
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { id } = await params;
	const context = await getCancellationContext(id);

	return {
		title: `Cancel Event | ${context.eventTitle} | Astrea Escrow`,
		description: `State-aware cancellation flow and refund management for ${context.eventTitle}.`,
	};
}

export default async function CancelEventPage({ params }: PageProps) {
	const { locale, id } = await params;
	const context = await getCancellationContext(id);

	if (!context) {
		notFound();
	}

	return (
		<main className="min-h-screen bg-background pb-16 pt-24">
			<div className="mx-auto max-w-5xl px-4 sm:px-6">
				{/* Breadcrumbs */}
				<nav
					aria-label="Breadcrumb"
					className="mb-6 flex items-center space-x-2 text-xs text-muted-foreground"
				>
					<Link
						href={`/${locale}`}
						className="transition-colors hover:text-foreground"
					>
						Home
					</Link>
					<ChevronRight className="h-3 w-3" />
					<Link
						href={`/${locale}/events/${id}`}
						className="transition-colors hover:text-foreground"
					>
						{context.eventTitle}
					</Link>
					<ChevronRight className="h-3 w-3" />
					<span className="font-medium text-foreground">Cancel Event</span>
				</nav>

				{/* Main interactive cancellation component */}
				<CancelEventAction context={context} locale={locale} />
			</div>
		</main>
	);
}
