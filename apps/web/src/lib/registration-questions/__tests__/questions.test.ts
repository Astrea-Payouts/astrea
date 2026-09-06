import { describe, expect, it } from "vitest";
import {
	addQuestion,
	createEmptyQuestion,
	deserializeQuestions,
	removeQuestion,
	reorderQuestions,
	serializeQuestions,
	updateQuestion,
	validateAnswers,
} from "../question-helpers";
import type { RegistrationQuestion } from "../types";

describe("Registration questions helpers (U17)", () => {
	const sampleQuestions: RegistrationQuestion[] = [
		{
			id: "q_diet",
			label: "Dietary Requirements",
			type: "single-select",
			options: ["Standard", "Vegetarian", "Vegan", "Halal"],
			required: true,
		},
		{
			id: "q_emp_id",
			label: "Employee ID",
			type: "text",
			required: false,
			placeholder: "e.g. EMP-1234",
		},
		{
			id: "q_in_person",
			label: "Attending in person?",
			type: "yes-no",
			required: true,
		},
	];

	describe("validateAnswers", () => {
		it("validates empty question list as always valid", () => {
			const res = validateAnswers([], {});
			expect(res.isValid).toBe(true);
			expect(res.errors).toEqual({});
		});

		it("fails validation when a required field is missing or empty", () => {
			const res = validateAnswers(sampleQuestions, {
				q_emp_id: "EMP-999",
			});
			expect(res.isValid).toBe(false);
			expect(res.errors.q_diet).toBeDefined();
			expect(res.errors.q_in_person).toBeDefined();
			expect(res.errors.q_emp_id).toBeUndefined(); // optional
		});

		it("passes validation when all required fields have valid values", () => {
			const res = validateAnswers(sampleQuestions, {
				q_diet: "Halal",
				q_in_person: true,
			});
			expect(res.isValid).toBe(true);
			expect(res.errors).toEqual({});
		});

		it("validates single-select option selection against available options", () => {
			const invalid = validateAnswers(sampleQuestions, {
				q_diet: "Keto-Carnivore-Invalid",
				q_in_person: true,
			});
			expect(invalid.isValid).toBe(false);
			expect(invalid.errors.q_diet).toContain("valid option");

			const valid = validateAnswers(sampleQuestions, {
				q_diet: "Vegetarian",
				q_in_person: false,
			});
			expect(valid.isValid).toBe(true);
		});

		it("validates yes-no inputs accurately", () => {
			const booleanValid = validateAnswers(sampleQuestions, {
				q_diet: "Standard",
				q_in_person: false,
			});
			expect(booleanValid.isValid).toBe(true);

			const stringValid = validateAnswers(sampleQuestions, {
				q_diet: "Standard",
				q_in_person: "yes",
			});
			expect(stringValid.isValid).toBe(true);

			const invalid = validateAnswers(sampleQuestions, {
				q_diet: "Standard",
				q_in_person: "maybe-later",
			});
			expect(invalid.isValid).toBe(false);
			expect(invalid.errors.q_in_person).toContain("Yes or No");
		});
	});

	describe("serializeQuestions & deserializeQuestions", () => {
		it("serializes and deserializes questions reliably (lossless roundtrip)", () => {
			const json = serializeQuestions(sampleQuestions);
			expect(typeof json).toBe("string");

			const parsed = deserializeQuestions(json);
			expect(parsed).toEqual(sampleQuestions);
		});

		it("handles invalid or null inputs gracefully", () => {
			expect(deserializeQuestions(null)).toEqual([]);
			expect(deserializeQuestions(undefined)).toEqual([]);
			expect(deserializeQuestions("")).toEqual([]);
			expect(deserializeQuestions("not-json-content")).toEqual([]);
			expect(deserializeQuestions('{"foo": "bar"}')).toEqual([]);
		});
	});

	describe("reorderQuestions", () => {
		it("moves items up and down within bounds", () => {
			const movedDown = reorderQuestions(sampleQuestions, 0, "down");
			expect(movedDown[0].id).toBe("q_emp_id");
			expect(movedDown[1].id).toBe("q_diet");

			const movedUp = reorderQuestions(movedDown, 1, "up");
			expect(movedUp[0].id).toBe("q_diet");
			expect(movedUp[1].id).toBe("q_emp_id");
		});

		it("leaves array intact when moving past edges", () => {
			const topUp = reorderQuestions(sampleQuestions, 0, "up");
			expect(topUp).toEqual(sampleQuestions);

			const bottomDown = reorderQuestions(sampleQuestions, 2, "down");
			expect(bottomDown).toEqual(sampleQuestions);
		});
	});

	describe("addQuestion, removeQuestion, and updateQuestion", () => {
		it("adds a new question with defaults", () => {
			const initial: RegistrationQuestion[] = [];
			const updated = addQuestion(initial, "single-select");
			expect(updated.length).toBe(1);
			expect(updated[0].type).toBe("single-select");
			expect(updated[0].options).toEqual(["Option 1", "Option 2"]);
		});

		it("removes a question by id", () => {
			const remaining = removeQuestion(sampleQuestions, "q_emp_id");
			expect(remaining.length).toBe(2);
			expect(remaining.find((q) => q.id === "q_emp_id")).toBeUndefined();
		});

		it("updates question properties and adjusts options when type switches", () => {
			const base = [createEmptyQuestion("text", "q_custom")];
			const updated = updateQuestion(base, "q_custom", {
				label: "Dietary Preference",
				type: "single-select",
			});
			expect(updated[0].label).toBe("Dietary Preference");
			expect(updated[0].type).toBe("single-select");
			expect(updated[0].options).toBeDefined();

			const switchedBack = updateQuestion(updated, "q_custom", {
				type: "text",
			});
			expect(switchedBack[0].type).toBe("text");
			expect(switchedBack[0].options).toBeUndefined();
		});
	});
});
