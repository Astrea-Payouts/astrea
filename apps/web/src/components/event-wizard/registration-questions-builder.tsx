"use client";

import {
	ArrowDown,
	ArrowUp,
	CheckSquare,
	Eye,
	HelpCircle,
	ListOrdered,
	Plus,
	ToggleLeft,
	ToggleRight,
	Trash2,
	Type,
} from "lucide-react";
import { useState } from "react";
import {
	addQuestion,
	removeQuestion,
	reorderQuestions,
	updateQuestion,
} from "@/lib/registration-questions/question-helpers";
import type {
	QuestionType,
	RegistrationQuestion,
} from "@/lib/registration-questions/types";
import { cn } from "@/lib/utils";

export interface RegistrationQuestionsBuilderProps {
	enabled: boolean;
	questions: RegistrationQuestion[];
	onToggleEnabled: (enabled: boolean) => void;
	onChangeQuestions: (questions: RegistrationQuestion[]) => void;
	className?: string;
}

export function RegistrationQuestionsBuilder({
	enabled,
	questions,
	onToggleEnabled,
	onChangeQuestions,
	className,
}: RegistrationQuestionsBuilderProps) {
	const [showPreview, setShowPreview] = useState(false);

	const handleAdd = (type: QuestionType = "text") => {
		const updated = addQuestion(questions, type);
		onChangeQuestions(updated);
	};

	const handleRemove = (id: string) => {
		const updated = removeQuestion(questions, id);
		onChangeQuestions(updated);
	};

	const handleReorder = (index: number, direction: "up" | "down") => {
		const updated = reorderQuestions(questions, index, direction);
		onChangeQuestions(updated);
	};

	const handleUpdate = (id: string, patch: Partial<RegistrationQuestion>) => {
		const updated = updateQuestion(questions, id, patch);
		onChangeQuestions(updated);
	};

	const handleAddOption = (
		questionId: string,
		currentOptions: string[] = [],
	) => {
		const newOption = `Option ${currentOptions.length + 1}`;
		handleUpdate(questionId, { options: [...currentOptions, newOption] });
	};

	const handleUpdateOption = (
		questionId: string,
		options: string[],
		optionIndex: number,
		newValue: string,
	) => {
		const nextOptions = [...options];
		nextOptions[optionIndex] = newValue;
		handleUpdate(questionId, { options: nextOptions });
	};

	const handleRemoveOption = (
		questionId: string,
		options: string[],
		optionIndex: number,
	) => {
		if (options.length <= 1) return; // Keep at least one option
		const nextOptions = options.filter((_, idx) => idx !== optionIndex);
		handleUpdate(questionId, { options: nextOptions });
	};

	return (
		<div
			className={cn(
				"rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur md:p-8",
				className,
			)}
		>
			{/* Toggle Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<HelpCircle className="size-5 text-indigo-400" />
						<h3 className="text-lg font-bold text-white">
							Custom Registration Questions
						</h3>
					</div>
					<p className="mt-1 text-xs text-zinc-400 max-w-xl">
						Ask participants a question or two upon registration (e.g. dietary
						requirements, team size, or employee ID). Off by default for 1-click
						registration.
					</p>
				</div>

				<button
					type="button"
					onClick={() => onToggleEnabled(!enabled)}
					aria-label={
						enabled
							? "Disable custom registration questions"
							: "Enable custom registration questions"
					}
					className={cn(
						"inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors w-fit",
						enabled
							? "bg-indigo-600 text-white hover:bg-indigo-500"
							: "bg-zinc-800 text-zinc-400 hover:text-white border border-white/10",
					)}
				>
					{enabled ? (
						<>
							<ToggleRight className="size-4" />
							<span>Enabled</span>
						</>
					) : (
						<>
							<ToggleLeft className="size-4" />
							<span>Disabled (Default)</span>
						</>
					)}
				</button>
			</div>

			{/* Builder Content when Enabled */}
			{enabled && (
				<div className="mt-6 space-y-4 border-t border-white/10 pt-6">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
							Configured Questions ({questions.length})
						</span>
						{questions.length > 0 && (
							<button
								type="button"
								onClick={() => setShowPreview(!showPreview)}
								className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
							>
								<Eye className="size-3.5" />
								<span>{showPreview ? "Hide Preview" : "Live Preview"}</span>
							</button>
						)}
					</div>

					{questions.length === 0 ? (
						<div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
							<p className="text-sm text-zinc-400">
								No questions defined. Click below to add a question.
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{questions.map((q, idx) => (
								<div
									key={q.id}
									className="rounded-xl border border-white/10 bg-black/40 p-4 transition-all"
								>
									<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
										<div className="flex items-center gap-2 flex-1">
											<div className="flex flex-col gap-0.5 text-zinc-500">
												<button
													type="button"
													disabled={idx === 0}
													onClick={() => handleReorder(idx, "up")}
													aria-label="Move question up"
													className="rounded hover:text-white disabled:opacity-30 transition-colors p-0.5"
												>
													<ArrowUp className="size-3.5" />
												</button>
												<button
													type="button"
													disabled={idx === questions.length - 1}
													onClick={() => handleReorder(idx, "down")}
													aria-label="Move question down"
													className="rounded hover:text-white disabled:opacity-30 transition-colors p-0.5"
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
													handleUpdate(q.id, { label: e.target.value })
												}
												placeholder="Enter question label (e.g. Dietary needs)..."
												className="flex-1 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
											/>
										</div>

										<div className="flex items-center gap-3">
											<select
												value={q.type}
												onChange={(e) =>
													handleUpdate(q.id, {
														type: e.target.value as QuestionType,
													})
												}
												aria-label="Question type"
												className="rounded-lg border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-white focus:outline-none focus:border-indigo-500"
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
														handleUpdate(q.id, { required: e.target.checked })
													}
													className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-0"
												/>
												<span>Required</span>
											</label>

											<button
												type="button"
												onClick={() => handleRemove(q.id)}
												aria-label="Delete question"
												className="rounded p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
											>
												<Trash2 className="size-4" />
											</button>
										</div>
									</div>

									{/* Sub-editor for Single Select options */}
									{q.type === "single-select" && (
										<div className="mt-3 pl-8 border-t border-white/5 pt-3">
											<span className="text-[11px] font-semibold text-zinc-500 block mb-2">
												Options List:
											</span>
											<div className="flex flex-wrap gap-2 items-center">
												{(q.options || []).map((opt, optIdx) => (
													<div
														key={`${q.id}_option_${opt}_${q.options?.length}`}
														className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-800/80 px-2 py-1"
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
															className="bg-transparent text-xs text-white focus:outline-none w-24"
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
													className="inline-flex items-center gap-1 rounded-md border border-dashed border-white/20 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-white transition-colors"
												>
													<Plus className="size-3" />
													<span>Add Option</span>
												</button>
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}

					{/* Add Question Actions */}
					<div className="flex flex-wrap items-center gap-2 pt-2">
						<button
							type="button"
							onClick={() => handleAdd("text")}
							className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
						>
							<Type className="size-3.5 text-indigo-400" />
							<span>+ Text Question</span>
						</button>

						<button
							type="button"
							onClick={() => handleAdd("single-select")}
							className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
						>
							<ListOrdered className="size-3.5 text-blue-400" />
							<span>+ Single Select</span>
						</button>

						<button
							type="button"
							onClick={() => handleAdd("yes-no")}
							className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
						>
							<CheckSquare className="size-3.5 text-emerald-400" />
							<span>+ Yes/No Toggle</span>
						</button>
					</div>

					{/* Live Preview Panel */}
					{showPreview && questions.length > 0 && (
						<div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-5 transition-all">
							<h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-3 flex items-center gap-1.5">
								<Eye className="size-3.5" />
								<span>Participant Preview</span>
							</h4>

							<div className="space-y-3">
								{questions.map((q) => (
									<div
										key={`prev_${q.id}`}
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
													<input type="radio" disabled name={`prev_${q.id}`} />
													<span>Yes</span>
												</label>
												<label className="inline-flex items-center gap-1">
													<input type="radio" disabled name={`prev_${q.id}`} />
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
