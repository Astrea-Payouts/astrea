"use client";

import { AlertCircle, HelpCircle } from "lucide-react";
import type {
	AnswerValue,
	RegistrationAnswers,
	RegistrationQuestion,
} from "@/lib/registration-questions/types";
import { cn } from "@/lib/utils";

export interface RegistrationQuestionsFormProps {
	questions: RegistrationQuestion[];
	answers: RegistrationAnswers;
	onChangeAnswers: (answers: RegistrationAnswers) => void;
	errors?: Record<string, string>;
	disabled?: boolean;
	className?: string;
}

export function RegistrationQuestionsForm({
	questions,
	answers,
	onChangeAnswers,
	errors = {},
	disabled = false,
	className,
}: RegistrationQuestionsFormProps) {
	// Acceptance Criterion: An event with no questions defined shows ZERO extra UI.
	if (!questions || questions.length === 0) {
		return null;
	}

	const handleAnswerChange = (questionId: string, value: AnswerValue) => {
		onChangeAnswers({
			...answers,
			[questionId]: value,
		});
	};

	return (
		<div
			className={cn(
				"rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur space-y-5",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<HelpCircle className="size-4 text-blue-400" />
				<h4 className="text-sm font-bold text-white uppercase tracking-wider">
					Additional Information
				</h4>
			</div>

			<div className="space-y-4">
				{questions.map((q) => {
					const inputId = `reg_q_${q.id}`;
					const currentVal = answers[q.id];
					const errorMsg = errors[q.id];

					return (
						<div key={q.id} className="space-y-1.5">
							<label
								htmlFor={q.type !== "yes-no" ? inputId : undefined}
								className="block text-xs font-medium text-zinc-300"
							>
								{q.label}
								{q.required && <span className="text-red-400 ml-1">*</span>}
							</label>

							{/* Type 1: Text Input */}
							{q.type === "text" && (
								<input
									id={inputId}
									type="text"
									value={typeof currentVal === "string" ? currentVal : ""}
									onChange={(e) => handleAnswerChange(q.id, e.target.value)}
									placeholder={q.placeholder || "Enter your answer..."}
									disabled={disabled}
									aria-required={q.required}
									aria-invalid={Boolean(errorMsg)}
									className={cn(
										"w-full rounded-xl border bg-black/40 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors",
										errorMsg
											? "border-red-500/50 focus:border-red-500"
											: "border-white/10 focus:border-blue-500",
									)}
								/>
							)}

							{/* Type 2: Single Select */}
							{q.type === "single-select" && (
								<select
									id={inputId}
									value={typeof currentVal === "string" ? currentVal : ""}
									onChange={(e) => handleAnswerChange(q.id, e.target.value)}
									disabled={disabled}
									aria-required={q.required}
									aria-invalid={Boolean(errorMsg)}
									className={cn(
										"w-full rounded-xl border bg-zinc-800 px-3.5 py-2 text-sm text-white focus:outline-none transition-colors",
										errorMsg
											? "border-red-500/50 focus:border-red-500"
											: "border-white/10 focus:border-blue-500",
									)}
								>
									<option value="">-- Select an option --</option>
									{(q.options || []).map((opt) => (
										<option key={opt} value={opt}>
											{opt}
										</option>
									))}
								</select>
							)}

							{/* Type 3: Yes / No */}
							{q.type === "yes-no" && (
								<div className="flex items-center gap-4 pt-1">
									<label className="inline-flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
										<input
											type="radio"
											name={`radio_${q.id}`}
											value="yes"
											checked={currentVal === true || currentVal === "yes"}
											onChange={() => handleAnswerChange(q.id, true)}
											disabled={disabled}
											className="border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0"
										/>
										<span>Yes</span>
									</label>

									<label className="inline-flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
										<input
											type="radio"
											name={`radio_${q.id}`}
											value="no"
											checked={currentVal === false || currentVal === "no"}
											onChange={() => handleAnswerChange(q.id, false)}
											disabled={disabled}
											className="border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0"
										/>
										<span>No</span>
									</label>
								</div>
							)}

							{errorMsg && (
								<div className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
									<AlertCircle className="size-3 shrink-0" />
									<span>{errorMsg}</span>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
