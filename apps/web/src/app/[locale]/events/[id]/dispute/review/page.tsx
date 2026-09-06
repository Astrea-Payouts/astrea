import { ChevronRight, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResolverReview } from "@/components/dispute/resolver-review";
import { getDisputeRecord } from "@/lib/dispute/events";

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
	const dispute = await getDisputeRecord(id);

	return {
		title: `Resolver Adjudication | ${dispute.eventTitle} | Astrea Escrow`,
		description: `Dispute review and prize release signing for ${dispute.milestoneTitle} by authorized escrow resolver.`,
	};
}

export default async function DisputeReviewPage({ params }: PageProps) {
	const { locale, id } = await params;
	const dispute = await getDisputeRecord(id);

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
						Resolver Adjudication
					</span>
				</nav>

				{/* Protocol Notice Banner */}
				<div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
					<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
					<div>
						<span className="font-semibold text-foreground">
							Stellar Escrow Protocol Safeguard (ADR-007 / Flow 5):
						</span>{" "}
						When an assigned judge is unreachable past the official judging
						deadline, the escrow dispute resolver reviews recorded submission
						scores and issues an on-chain resolution payout directly to the
						verified winner. Payouts do not rely on an unresponsive judge.
					</div>
				</div>

				{/* Main interactive resolver review component */}
				<ResolverReview dispute={dispute} locale={locale} />
			</div>
		</main>
	);
}
