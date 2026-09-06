export type QuestionType = "text" | "single-select" | "yes-no";

export interface RegistrationQuestion {
	id: string;
	label: string;
	type: QuestionType;
	options?: string[];
	required: boolean;
	placeholder?: string;
}

export type AnswerValue = string | boolean;

export type RegistrationAnswers = Record<string, AnswerValue>;

export interface QuestionValidationResult {
	isValid: boolean;
	errors: Record<string, string>;
}

export interface QuestionBuilderState {
	enabled: boolean;
	questions: RegistrationQuestion[];
}
