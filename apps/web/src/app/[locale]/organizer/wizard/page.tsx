import { ArrowLeft } from "lucide-react";
import { WizardStepper } from "@/components/event-wizard/wizard-stepper";
import { Link } from "@/i18n/navigation";

export default function EventWizardPage() {
	return (
		<main className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-4xl space-y-6">
				<div>
					<Link
						href="/organizer"
						className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
					>
						<ArrowLeft className="size-4" />
						<span>Back to Organizer Hub</span>
					</Link>
				</div>

				<WizardStepper />
			</div>
		</main>
	);
}
