import { ChevronRight, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelDistributionReview } from "@/components/dispute/cancel-distribution-review";
import { getCancelDisputeRecord } from "@/lib/dispute/events";

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
	const dispute = await getCancelDisputeRecord(id);

	return {
		title: `Cancel Distribution Adjudication | ${dispute.eventTitle} | Astrea Escrow`,
		description: `Resolver review and fund distribution signing for cancelled event ${dispute.eventTitle} under ADR-006 rules.`,
	};
}

export default async function CancelDisputePage({ params }: PageProps) {
	const { locale, id } = await params;
	const dispute = await getCancelDisputeRecord(id);

	if (!dispute) {
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
						{dispute.eventTitle}
					</Link>
					<ChevronRight className="h-3 w-3" />
					<span className="text-muted-foreground">Dispute</span>
					<ChevronRight className="h-3 w-3" />
					<span className="font-medium text-foreground">
						Cancel Distribution
					</span>
				</nav>

				{/* Protocol Safeguard Banner */}
				<div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
					<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
					<div>
						<span className="font-semibold text-foreground">
							Stellar Escrow Protocol Rule ADR-006 (Cancel-after-Launch):
						</span>{" "}
						When an organizer requests to unwind an active event that is already
						LIVE, funds cannot be automatically refunded to the organizer. The
						neutral dispute resolver determines an equitable distribution split
						to protect participants from uncompensated labor.
					</div>
				</div>

				{/* Main interactive resolver cancel review component */}
				<CancelDistributionReview dispute={dispute} locale={locale} />
			</div>
		</main>
	);
}
