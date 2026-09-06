import type {
	EventDetailsData,
	JudgesResolverData,
	StepValidationResult,
	WizardDraftState,
} from "./types";

export const WIZARD_STORAGE_KEY = "astrea_event_wizard_draft_v1";

/**
 * Validates a Stellar Ed25519 public key.
 * Must start with 'G', be exactly 56 characters, and contain only valid RFC 4648 Base32 uppercase characters.
 */
export function isValidStellarAddress(address: string): boolean {
	if (!address || typeof address !== "string") return false;
	const trimmed = address.trim();
	if (trimmed.length !== 56) return false;
	if (!trimmed.startsWith("G")) return false;
	return /^[A-Z2-7]{56}$/.test(trimmed);
}

/**
 * Validates Step 1: Details.
 * Acceptance criteria: Cannot proceed with missing fields or out-of-order dates.
 * Enforces chronological sequence: registrationCloseDate <= submissionDeadline <= judgingDeadline.
 */
export function validateEventDetails(
	data: EventDetailsData,
): StepValidationResult {
	const errors: Record<string, string> = {};

	if (!data.name || data.name.trim() === "") {
		errors.name = "Event name is required.";
	}

	if (!data.description || data.description.trim() === "") {
		errors.description = "Event description is required.";
	}

	if (!data.registrationCloseDate) {
		errors.registrationCloseDate = "Registration close date is required.";
	}

	if (!data.submissionDeadline) {
		errors.submissionDeadline = "Submission deadline is required.";
	}

	if (!data.judgingDeadline) {
		errors.judgingDeadline = "Judging deadline is required.";
	}

	if (data.registrationCloseDate && data.submissionDeadline) {
		const regClose = new Date(data.registrationCloseDate).getTime();
		const subDeadline = new Date(data.submissionDeadline).getTime();

		if (Number.isNaN(regClose)) {
			errors.registrationCloseDate = "Invalid registration close date.";
		}
		if (Number.isNaN(subDeadline)) {
			errors.submissionDeadline = "Invalid submission deadline.";
		}

		if (
			!Number.isNaN(regClose) &&
			!Number.isNaN(subDeadline) &&
			regClose > subDeadline
		) {
			errors.registrationCloseDate =
				"Registration close date must be on or before the submission deadline.";
		}
	}

	if (data.submissionDeadline && data.judgingDeadline) {
		const subDeadline = new Date(data.submissionDeadline).getTime();
		const judgDeadline = new Date(data.judgingDeadline).getTime();

		if (Number.isNaN(judgDeadline)) {
			errors.judgingDeadline = "Invalid judging deadline.";
		}

		if (
			!Number.isNaN(subDeadline) &&
			!Number.isNaN(judgDeadline) &&
			subDeadline > judgDeadline
		) {
			errors.judgingDeadline =
				"Judging deadline must be on or after the submission deadline.";
		}
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
}

/**
 * Validates Step 3: Judges & Resolver.
 * Acceptance criteria: Invalid address formats are caught before Next;
 * blank resolver clearly shows the Astrea-default state.
 */
export function validateJudgesResolver(
	data: JudgesResolverData,
): StepValidationResult {
	const errors: Record<string, string> = {};

	if (!data.judgeName || data.judgeName.trim() === "") {
		errors.judgeName = "Judge display name is required.";
	}

	if (!data.judgeAddress || data.judgeAddress.trim() === "") {
		errors.judgeAddress = "Judge Stellar public key is required.";
	} else if (!isValidStellarAddress(data.judgeAddress)) {
		errors.judgeAddress =
			"Invalid Stellar address format. Must be a 56-character public key starting with 'G'.";
	}

	if (data.resolverAddress && data.resolverAddress.trim() !== "") {
		if (!isValidStellarAddress(data.resolverAddress)) {
			errors.resolverAddress =
				"Invalid resolver address format. Must be a 56-character public key starting with 'G'.";
		}
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
}

export function getDefaultWizardDraft(): WizardDraftState {
	return {
		details: {
			name: "",
			description: "",
			registrationCloseDate: "",
			submissionDeadline: "",
			judgingDeadline: "",
		},
		judgesResolver: {
			judgeAddress: "",
			judgeName: "",
			resolverAddress: "",
			useDefaultResolver: true,
		},
		participants: {
			enableCustomQuestions: false,
			questions: [],
		},
		currentStep: 1,
	};
}

const memoryStorage: Record<string, string> = {};

export function saveWizardDraft(draft: WizardDraftState): void {
	try {
		const payload = {
			...draft,
			lastSavedAt: new Date().toISOString(),
		};
		const str = JSON.stringify(payload);
		if (typeof window !== "undefined" && window.localStorage) {
			window.localStorage.setItem(WIZARD_STORAGE_KEY, str);
		} else {
			memoryStorage[WIZARD_STORAGE_KEY] = str;
		}
	} catch (e) {
		console.error("Failed to save wizard draft to localStorage:", e);
	}
}

export function loadWizardDraft(): WizardDraftState {
	try {
		let raw: string | null = null;
		if (typeof window !== "undefined" && window.localStorage) {
			raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
		} else {
			raw = memoryStorage[WIZARD_STORAGE_KEY] || null;
		}
		if (!raw) return getDefaultWizardDraft();
		const parsed = JSON.parse(raw);
		return {
			details: parsed.details || getDefaultWizardDraft().details,
			judgesResolver:
				parsed.judgesResolver || getDefaultWizardDraft().judgesResolver,
			participants: parsed.participants || getDefaultWizardDraft().participants,
			currentStep:
				typeof parsed.currentStep === "number" ? parsed.currentStep : 1,
			lastSavedAt: parsed.lastSavedAt,
		};
	} catch {
		return getDefaultWizardDraft();
	}
}

export function clearWizardDraft(): void {
	try {
		if (typeof window !== "undefined" && window.localStorage) {
			window.localStorage.removeItem(WIZARD_STORAGE_KEY);
		}
		delete memoryStorage[WIZARD_STORAGE_KEY];
	} catch (e) {
		console.error("Failed to clear wizard draft:", e);
	}
}
