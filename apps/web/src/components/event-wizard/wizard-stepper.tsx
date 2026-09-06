"use client";

import {
	ArrowLeft,
	ArrowRight,
	Check,
	CheckCircle2,
	Coins,
	RotateCcw,
	Save,
	Scale,
	ShieldCheck,
	Sparkles,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
	EventDetailsData,
	JudgesResolverData,
	ParticipantsStepData,
	WizardDraftState,
} from "@/lib/event-wizard/types";
import {
	clearWizardDraft,
	getDefaultWizardDraft,
	loadWizardDraft,
	saveWizardDraft,
	validateEventDetails,
	validateJudgesResolver,
} from "@/lib/event-wizard/wizard-helpers";
import { cn } from "@/lib/utils";
import { StepDetails } from "./step-details";
import { StepJudgesResolver } from "./step-judges-resolver";
import { StepParticipants } from "./step-participants";

export interface WizardStepperProps {
	className?: string;
}

const WIZARD_STEPS = [
	{ id: 1, label: "Details", icon: Sparkles, activeInU01a: true },
	{ id: 2, label: "Prizes (U01b)", icon: Coins, activeInU01a: false },
	{ id: 3, label: "Judges & Resolver", icon: Scale, activeInU01a: true },
	{ id: 4, label: "Participants", icon: Users, activeInU01a: true },
	{
		id: 5,
		label: "Review & Sign (U01c)",
		icon: ShieldCheck,
		activeInU01a: false,
	},
];

export function WizardStepper({ className }: WizardStepperProps) {
	const [draft, setDraft] = useState<WizardDraftState>(getDefaultWizardDraft());
	const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>(
		{},
	);
	const [judgesErrors, setJudgesErrors] = useState<Record<string, string>>({});
	const [savedNotification, setSavedNotification] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);

	// Load draft from localStorage on mount (survives refresh)
	useEffect(() => {
		const loaded = loadWizardDraft();
		setDraft(loaded);
		setIsLoaded(true);
	}, []);

	// Autosave draft on every state change once loaded
	useEffect(() => {
		if (isLoaded) {
			saveWizardDraft(draft);
		}
	}, [draft, isLoaded]);

	const handleDetailsChange = (details: EventDetailsData) => {
		setDraft((prev) => ({ ...prev, details }));
		if (Object.keys(detailsErrors).length > 0) {
			const res = validateEventDetails(details);
			setDetailsErrors(res.errors);
		}
	};

	const handleJudgesChange = (judgesResolver: JudgesResolverData) => {
		setDraft((prev) => ({ ...prev, judgesResolver }));
		if (Object.keys(judgesErrors).length > 0) {
			const res = validateJudgesResolver(judgesResolver);
			setJudgesErrors(res.errors);
		}
	};

	const handleParticipantsChange = (participants: ParticipantsStepData) => {
		setDraft((prev) => ({ ...prev, participants }));
	};

	const handleNext = () => {
		if (draft.currentStep === 1) {
			const res = validateEventDetails(draft.details);
			if (!res.isValid) {
				setDetailsErrors(res.errors);
				return;
			}
			setDetailsErrors({});
			// Step 2 is Prizes (U01b); advance to Step 3 for U01a flow
			setDraft((prev) => ({ ...prev, currentStep: 3 }));
			return;
		}

		if (draft.currentStep === 3) {
			const res = validateJudgesResolver(draft.judgesResolver);
			if (!res.isValid) {
				setJudgesErrors(res.errors);
				return;
			}
			setJudgesErrors({});
			setDraft((prev) => ({ ...prev, currentStep: 4 }));
			return;
		}

		if (draft.currentStep === 4) {
			// Completed U01a steps
			setDraft((prev) => ({ ...prev, currentStep: 5 }));
		}
	};

	const handlePrev = () => {
		if (draft.currentStep === 4) {
			setDraft((prev) => ({ ...prev, currentStep: 3 }));
		} else if (draft.currentStep === 3) {
			setDraft((prev) => ({ ...prev, currentStep: 1 }));
		} else if (draft.currentStep === 5) {
			setDraft((prev) => ({ ...prev, currentStep: 4 }));
		}
	};

	const handleManualSave = () => {
		saveWizardDraft(draft);
		setSavedNotification(true);
		setTimeout(() => setSavedNotification(false), 2000);
	};

	const handleResetDraft = () => {
		clearWizardDraft();
		setDraft(getDefaultWizardDraft());
		setDetailsErrors({});
		setJudgesErrors({});
	};

	return (
		<div className={cn("space-y-8", className)}>
			{/* Stepper Header Bar */}
			<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 backdrop-blur md:p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
					<div>
						<h2 className="text-xl font-bold text-white">
							Create Escrow-Backed Event
						</h2>
						<p className="text-xs text-zinc-400">
							Configure details, signers, and registration requirements.
						</p>
					</div>

					<div className="flex items-center gap-2">
						{savedNotification && (
							<span className="inline-flex items-center gap-1 text-xs text-emerald-400">
								<CheckCircle2 className="size-3.5" />
								Draft Saved
							</span>
						)}
						<button
							type="button"
							onClick={handleManualSave}
							className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
						>
							<Save className="size-3.5" />
							<span>Save Draft</span>
						</button>
						<button
							type="button"
							onClick={handleResetDraft}
							title="Reset all draft fields"
							className="rounded-lg border border-white/10 bg-black/40 p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
						>
							<RotateCcw className="size-3.5" />
						</button>
					</div>
				</div>

				{/* Steps Progress Pills */}
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
					{WIZARD_STEPS.map((s) => {
						const Icon = s.icon;
						const isCurrent = draft.currentStep === s.id;
						const isPassed = draft.currentStep > s.id;

						return (
							<div
								key={s.id}
								className={cn(
									"flex items-center gap-2 rounded-xl p-2.5 text-xs transition-colors border",
									isCurrent
										? "border-blue-500/40 bg-blue-500/10 text-white font-bold"
										: isPassed
											? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 font-medium"
											: "border-white/5 bg-black/20 text-zinc-500 font-normal",
								)}
							>
								<div
									className={cn(
										"flex size-6 items-center justify-center rounded-lg text-[11px]",
										isCurrent
											? "bg-blue-500 text-white"
											: isPassed
												? "bg-emerald-500/20 text-emerald-400"
												: "bg-zinc-800 text-zinc-500",
									)}
								>
									{isPassed ? <Check className="size-3" /> : s.id}
								</div>
								<Icon className="size-3.5 shrink-0 opacity-70" />
								<span className="truncate">{s.label}</span>
							</div>
						);
					})}
				</div>
			</div>

			{/* Active Step Content */}
			<div>
				{draft.currentStep === 1 && (
					<StepDetails
						data={draft.details}
						onChange={handleDetailsChange}
						errors={detailsErrors}
					/>
				)}

				{draft.currentStep === 3 && (
					<StepJudgesResolver
						data={draft.judgesResolver}
						onChange={handleJudgesChange}
						errors={judgesErrors}
					/>
				)}

				{draft.currentStep === 4 && (
					<StepParticipants
						data={draft.participants}
						onChange={handleParticipantsChange}
					/>
				)}

				{draft.currentStep === 5 && (
					<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8 text-center space-y-4">
						<CheckCircle2 className="mx-auto size-12 text-emerald-400" />
						<h3 className="text-xl font-bold text-white">
							Wizard Steps 1, 3, 4 Completed!
						</h3>
						<p className="text-sm text-zinc-400 max-w-md mx-auto">
							All details, judge credentials, and participant questions are
							configured and safely saved to your draft. Step 2 (Prizes) and
							Step 5 (Review & Sign) will finalize the contract deployment.
						</p>
					</div>
				)}
			</div>

			{/* Navigation Footer */}
			<div className="flex items-center justify-between border-t border-white/10 pt-6">
				<div>
					{draft.currentStep > 1 && (
						<button
							type="button"
							onClick={handlePrev}
							className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
						>
							<ArrowLeft className="size-4" />
							<span>Previous Step</span>
						</button>
					)}
				</div>

				<div className="flex items-center gap-3">
					<span className="text-xs text-zinc-500">Auto-saved locally</span>
					{draft.currentStep < 5 && (
						<button
							type="button"
							onClick={handleNext}
							className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors shadow-sm"
						>
							<span>Continue</span>
							<ArrowRight className="size-4" />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
