import { ArrowLeft, Scale, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { OpenDisputeForm } from "@/components/dispute/open-dispute-form";
import { Link } from "@/i18n/navigation";
import { getDisputeEventContext } from "@/lib/dispute/events";

interface DisputePageProps {
	params: Promise<{
		locale: string;
		id: string;
	}>;
}

export default async function DisputePage({ params }: DisputePageProps) {
	const { id } = await params;
	const event = await getDisputeEventContext(id);

	if (!event) {
		notFound();
	}

	return (
		<main className="flex-1 pt-24 pb-12 px-6 md:py-12 md:px-12 bg-black text-white">
			<div className="mx-auto max-w-4xl">
				{/* Breadcrumb back to event */}{" "}
				<div className="mb-6">
					<Link
						href="/"
						className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
					>
						<ArrowLeft className="size-3.5" />
						<span>Back to Overview</span>
					</Link>
				</div>
				{/* Header info */}{" "}
				<div className="mb-8">
					<div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
						<Scale className="size-3.5" />
						<span>Escrow Protection Protocol (Flow 5)</span>
					</div>
					<h1 className="mt-3 font-serif text-3xl font-bold tracking-tight md:text-4xl">
						Open Dispute on {event.title}
					</h1>
					<p className="mt-2 text-sm leading-relaxed text-zinc-400">
						Submit a formal contest on milestone evaluations or unfulfilled
						judging deadlines. Opening a dispute freezes unilateral prize
						releases and initiates independent resolver adjudication.
					</p>
				</div>
				<div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
					{/* Main Form */}{" "}
					<div className="lg:col-span-8">
						<OpenDisputeForm event={event} />
					</div>
					{/* Dispute Info Sidebar */}{" "}
					<div className="space-y-6 lg:col-span-4">
						<div className="rounded-xl border border-white/10 bg-zinc-900/60 p-5 text-xs text-zinc-400">
							<h4 className="flex items-center gap-1.5 font-semibold text-white uppercase tracking-wider text-[11px]">
								<ShieldCheck className="size-4 text-blue-400" />
								Dispute Rules & Safeguards
							</h4>
							<ul className="mt-3 space-y-2.5 leading-relaxed">
								<li>
									<strong className="text-zinc-200">Eligible Parties:</strong>{" "}
									Only registered participants, judges, or the organizer may
									open a dispute.
								</li>
								<li>
									<strong className="text-zinc-200">Resolver Exclusion:</strong>{" "}
									The assigned resolver cannot open a dispute on their own
									escrow (enforced server-side to prevent conflict of interest).
								</li>
								<li>
									<strong className="text-zinc-200">
										Immediate Escrow Lock:
									</strong>{" "}
									Submitting a dispute transitions the milestone to{" "}
									<span className="font-mono text-amber-400">DISPUTED</span>,
									halting standard payouts.
								</li>
							</ul>
						</div>

						<div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 font-mono text-xs text-zinc-400">
							<span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
								Escrow Resolver
							</span>
							<span className="mt-1 block truncate text-zinc-300">
								{event.resolverAddress}
							</span>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
