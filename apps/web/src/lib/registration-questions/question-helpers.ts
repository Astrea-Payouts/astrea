import type {
	QuestionType,
	QuestionValidationResult,
	RegistrationAnswers,
	RegistrationQuestion,
} from "./types";

export function createEmptyQuestion(
	type: QuestionType = "text",
	customId?: string,
): RegistrationQuestion {
	const id =
		customId || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	return {
		id,
		label: "",
		type,
		required: false,
		options: type === "single-select" ? ["Option 1", "Option 2"] : undefined,
		placeholder: type === "text" ? "Enter your answer..." : undefined,
	};
}

export function validateAnswers(
	questions: RegistrationQuestion[],
	answers: RegistrationAnswers,
): QuestionValidationResult {
	const errors: Record<string, string> = {};

	for (const q of questions) {
		const val = answers[q.id];

		if (q.required) {
			if (val === undefined || val === null || val === "") {
				errors[q.id] = "This question is required.";
				continue;
			}
		}

		if (val !== undefined && val !== null && val !== "") {
			if (q.type === "single-select") {
				const strVal = String(val);
				if (q.options && !q.options.includes(strVal)) {
					errors[q.id] = "Please select a valid option from the list.";
				}
			} else if (q.type === "yes-no") {
				if (typeof val !== "boolean" && val !== "yes" && val !== "no") {
					errors[q.id] = "Please select either Yes or No.";
				}
			}
		}
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
}

export function serializeQuestions(questions: RegistrationQuestion[]): string {
	return JSON.stringify(questions);
}

export function deserializeQuestions(
	raw: string | null | undefined,
): RegistrationQuestion[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(item) =>
				item &&
				typeof item.id === "string" &&
				typeof item.label === "string" &&
				["text", "single-select", "yes-no"].includes(item.type),
		);
	} catch {
		return [];
	}
}

export function reorderQuestions(
	questions: RegistrationQuestion[],
	index: number,
	direction: "up" | "down",
): RegistrationQuestion[] {
	const targetIndex = direction === "up" ? index - 1 : index + 1;
	if (targetIndex < 0 || targetIndex >= questions.length) {
		return questions;
	}
	const result = [...questions];
	const [moved] = result.splice(index, 1);
	result.splice(targetIndex, 0, moved);
	return result;
}

export function addQuestion(
	questions: RegistrationQuestion[],
	type: QuestionType = "text",
): RegistrationQuestion[] {
	return [...questions, createEmptyQuestion(type)];
}

export function removeQuestion(
	questions: RegistrationQuestion[],
	id: string,
): RegistrationQuestion[] {
	return questions.filter((q) => q.id !== id);
}

export function updateQuestion(
	questions: RegistrationQuestion[],
	id: string,
	patch: Partial<RegistrationQuestion>,
): RegistrationQuestion[] {
	return questions.map((q) => {
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
	});
}
