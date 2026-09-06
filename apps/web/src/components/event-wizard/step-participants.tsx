"use client";

import {
	ArrowDown,
	ArrowUp,
	CheckSquare,
	Eye,
	ListOrdered,
	Plus,
	ToggleLeft,
	ToggleRight,
	Trash2,
	Type,
	UserCheck,
	Users,
} from "lucide-react";
import { useState } from "react";
import type {
	ParticipantsStepData,
	QuestionType,
	RegistrationQuestion,
} from "@/lib/event-wizard/types";
import { cn } from "@/lib/utils";

export interface StepParticipantsProps {
	data: ParticipantsStepData;
	onChange: (data: ParticipantsStepData) => void;
	className?: string;
}

export function StepParticipants({
	data,
	onChange,
	className,
}: StepParticipantsProps) {
	const [showPreview, setShowPreview] = useState(false);

	const handleToggle = (enabled: boolean) => {
		// Acceptance Criterion: Preserve questions if toggled off and back on
		onChange({
			...data,
			enableCustomQuestions: enabled,
		});
	};

	const handleAddQuestion = (type: QuestionType = "text") => {
		const newQuestion: RegistrationQuestion = {
			id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			label: "",
			type,
			required: false,
			options: type === "single-select" ? ["Option 1", "Option 2"] : undefined,
			placeholder: type === "text" ? "Enter your answer..." : undefined,
		};
		onChange({
			...data,
			questions: [...data.questions, newQuestion],
		});
	};

	const handleRemoveQuestion = (id: string) => {
		onChange({
			...data,
			questions: data.questions.filter((q) => q.id !== id),
		});
	};

	const handleReorder = (index: number, direction: "up" | "down") => {
		const targetIndex = direction === "up" ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= data.questions.length) return;
		const nextQuestions = [...data.questions];
		const [moved] = nextQuestions.splice(index, 1);
		nextQuestions.splice(targetIndex, 0, moved);
		onChange({
			...data,
			questions: nextQuestions,
		});
	};

	const handleUpdateQuestion = (
		id: string,
		patch: Partial<RegistrationQuestion>,
	) => {
		onChange({
			...data,
			questions: data.questions.map((q) => {
				if (q.id !== id) return q;
				const updated = { ...q, ...patch };
				if (patch.type && patch.type !== q.type) {
					if (
						patch.type === "single-select" &&
						(!updated.options || updated.options.length === 0)
					) {
						updated.options = ["Option 1", "Option 2"];
					} else if (patch.type !== "single-select") {
						delete updated.options;
					}
				}
				return updated;
			}),
		});
	};

	const handleAddOption = (
		questionId: string,
		currentOptions: string[] = [],
	) => {
		const newOption = `Option ${currentOptions.length + 1}`;
		handleUpdateQuestion(questionId, {
			options: [...currentOptions, newOption],
		});
	};

	const handleUpdateOption = (
		questionId: string,
		options: string[],
		optionIndex: number,
		newValue: string,
	) => {
		const next = [...options];
		next[optionIndex] = newValue;
		handleUpdateQuestion(questionId, { options: next });
	};

	const handleRemoveOption = (
		questionId: string,
		options: string[],
		optionIndex: number,
	) => {
		if (options.length <= 1) return;
		const next = options.filter((_, idx) => idx !== optionIndex);
		handleUpdateQuestion(questionId, { options: next });
	};

	return (
		<div
			className={cn(
				"rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur space-y-6 md:p-8",
				className,
			)}
		>
			<div className="flex items-center gap-3">
				<div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
					<Users className="size-5" />
				</div>
				<div>
					<h3 className="text-lg font-bold text-white">
						Participant Registration Flow
					</h3>
					<p className="text-xs text-zinc-400">
						Configure the registration experience and optional attendee
						questions.
					</p>
				</div>
			</div>

			{/* Toggle Card */}
			<div className="rounded-xl border border-white/5 bg-black/40 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="max-w-xl">
					<div className="flex items-center gap-2">
						<UserCheck className="size-4 text-emerald-400" />
						<span className="font-semibold text-sm text-white">
							Custom Registration Questions (U17)
						</span>
					</div>
					<p className="mt-1 text-xs text-zinc-400">
						Ask participants a question or two upon registration (dietary needs,
						team size, employee ID). Defaults to off for frictionless 1-click
						registration.
					</p>
				</div>

				<button
					type="button"
					onClick={() => handleToggle(!data.enableCustomQuestions)}
					aria-label={
						data.enableCustomQuestions
							? "Disable custom registration questions"
							: "Enable custom registration questions"
					}
					className={cn(
						"inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors shrink-0",
						data.enableCustomQuestions
							? "bg-emerald-500 text-black hover:bg-emerald-400"
							: "bg-zinc-800 text-zinc-400 hover:text-white border border-white/10",
					)}
				>
					{data.enableCustomQuestions ? (
						<>
							<ToggleRight className="size-4" />
							<span>Questions Enabled</span>
						</>
					) : (
						<>
							<ToggleLeft className="size-4" />
							<span>Disabled (1-Click Active)</span>
						</>
					)}
				</button>
			</div>

			{/* Questions Builder when enabled */}
			{data.enableCustomQuestions && (
				<div className="space-y-4 pt-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
							Questions List ({data.questions.length})
						</span>
						{data.questions.length > 0 && (
							<button
								type="button"
								onClick={() => setShowPreview(!showPreview)}
								className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
							>
								<Eye className="size-3.5" />
								<span>{showPreview ? "Hide Preview" : "Live Preview"}</span>
							</button>
						)}
					</div>

					{data.questions.length === 0 ? (
						<div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
							<p className="text-sm text-zinc-400">
								No questions added yet. Choose a question type below to start.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{data.questions.map((q, idx) => (
								<div
									key={q.id}
									className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3"
								>
									<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
										<div className="flex items-center gap-2 flex-1">
											<div className="flex flex-col gap-0.5 text-zinc-500">
												<button
													type="button"
													disabled={idx === 0}
													onClick={() => handleReorder(idx, "up")}
													aria-label="Move question up"
													className="rounded hover:text-white disabled:opacity-30 p-0.5"
												>
													<ArrowUp className="size-3.5" />
												</button>
												<button
													type="button"
													disabled={idx === data.questions.length - 1}
													onClick={() => handleReorder(idx, "down")}
													aria-label="Move question down"
													className="rounded hover:text-white disabled:opacity-30 p-0.5"
												>
													<ArrowDown className="size-3.5" />
												</button>
											</div>

											<span className="text-xs font-bold text-zinc-500 font-mono">
												#{idx + 1}
											</span>

											<input
												type="text"
												value={q.label}
												onChange={(e) =>
													handleUpdateQuestion(q.id, { label: e.target.value })
												}
												placeholder="e.g. Dietary preferences or team size..."
												className="flex-1 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
											/>
										</div>

										<div className="flex items-center gap-3">
											<select
												value={q.type}
												onChange={(e) =>
													handleUpdateQuestion(q.id, {
														type: e.target.value as QuestionType,
													})
												}
												aria-label="Question type"
												className="rounded-lg border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
											>
												<option value="text">Text Input</option>
												<option value="single-select">Single Select</option>
												<option value="yes-no">Yes / No</option>
											</select>

											<label className="inline-flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
												<input
													type="checkbox"
													checked={q.required}
													onChange={(e) =>
														handleUpdateQuestion(q.id, {
															required: e.target.checked,
														})
													}
													className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
												/>
												<span>Required</span>
											</label>

											<button
												type="button"
												onClick={() => handleRemoveQuestion(q.id)}
												aria-label="Delete question"
												className="rounded p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
											>
												<Trash2 className="size-4" />
											</button>
										</div>
									</div>

									{/* Options for single-select */}
									{q.type === "single-select" && (
										<div className="pl-8 pt-2 border-t border-white/5 flex flex-wrap gap-2 items-center">
											<span className="text-[11px] font-semibold text-zinc-500 mr-1">
												Options:
											</span>
											{(q.options || []).map((opt, optIdx) => (
												<div
													key={`${q.id}_opt_${opt}_${q.options?.length}`}
													className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-800/80 px-2 py-0.5"
												>
													<input
														type="text"
														value={opt}
														onChange={(e) =>
															handleUpdateOption(
																q.id,
																q.options || [],
																optIdx,
																e.target.value,
															)
														}
														className="bg-transparent text-xs text-white focus:outline-none w-20"
													/>
													{(q.options || []).length > 1 && (
														<button
															type="button"
															onClick={() =>
																handleRemoveOption(
																	q.id,
																	q.options || [],
																	optIdx,
																)
															}
															className="text-zinc-500 hover:text-red-400 text-xs"
														>
															×
														</button>
													)}
												</div>
											))}

											<button
												type="button"
												onClick={() => handleAddOption(q.id, q.options)}
												className="inline-flex items-center gap-1 rounded-md border border-dashed border-white/20 px-2 py-0.5 text-[11px] font-medium text-zinc-400 hover:text-white"
											>
												<Plus className="size-3" />
												<span>Add Option</span>
											</button>
										</div>
									)}
								</div>
							))}
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex flex-wrap items-center gap-2 pt-2">
						<button
							type="button"
							onClick={() => handleAddQuestion("text")}
							className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
						>
							<Type className="size-3.5 text-indigo-400" />
							<span>+ Text Question</span>
						</button>

						<button
							type="button"
							onClick={() => handleAddQuestion("single-select")}
							className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
						>
							<ListOrdered className="size-3.5 text-blue-400" />
							<span>+ Single Select</span>
						</button>

						<button
							type="button"
							onClick={() => handleAddQuestion("yes-no")}
							className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
						>
							<CheckSquare className="size-3.5 text-emerald-400" />
							<span>+ Yes/No Toggle</span>
						</button>
					</div>

					{/* Live Preview */}
					{showPreview && data.questions.length > 0 && (
						<div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-3">
							<div className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
								<Eye className="size-3.5" />
								<span>Participant Form Preview</span>
							</div>

							<div className="space-y-3">
								{data.questions.map((q) => (
									<div
										key={`preview_${q.id}`}
										className="rounded-lg border border-white/5 bg-black/40 p-3"
									>
										<div className="block text-xs font-medium text-zinc-300 mb-1">
											{q.label || "Untitled Question"}
											{q.required && (
												<span className="text-red-400 ml-1">*</span>
											)}
										</div>

										{q.type === "text" && (
											<input
												type="text"
												disabled
												placeholder={q.placeholder || "Answer..."}
												className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-400"
											/>
										)}

										{q.type === "single-select" && (
											<select
												disabled
												className="w-full rounded-md border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400"
											>
												{(q.options || []).map((opt) => (
													<option key={opt}>{opt}</option>
												))}
											</select>
										)}

										{q.type === "yes-no" && (
											<div className="flex items-center gap-3 text-xs text-zinc-400">
												<label className="inline-flex items-center gap-1">
													<input type="radio" disabled name={`p_${q.id}`} />
													<span>Yes</span>
												</label>
												<label className="inline-flex items-center gap-1">
													<input type="radio" disabled name={`p_${q.id}`} />
													<span>No</span>
												</label>
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
