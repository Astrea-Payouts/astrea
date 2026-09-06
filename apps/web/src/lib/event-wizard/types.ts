export type QuestionType = "text" | "single-select" | "yes-no";

export interface RegistrationQuestion {
	id: string;
	label: string;
	type: QuestionType;
	options?: string[];
	required: boolean;
	placeholder?: string;
}

export interface EventDetailsData {
	name: string;
	description: string;
	registrationCloseDate: string;
	submissionDeadline: string;
	judgingDeadline: string;
}

export interface JudgesResolverData {
	judgeAddress: string;
	judgeName: string;
	resolverAddress: string;
	useDefaultResolver: boolean;
}

export interface ParticipantsStepData {
	enableCustomQuestions: boolean;
	questions: RegistrationQuestion[];
}

export interface WizardDraftState {
	details: EventDetailsData;
	judgesResolver: JudgesResolverData;
	participants: ParticipantsStepData;
	currentStep: number;
	lastSavedAt?: string;
}

export interface StepValidationResult {
	isValid: boolean;
	errors: Record<string, string>;
}
