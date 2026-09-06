import { beforeEach, describe, expect, it } from "vitest";
import type { EventDetailsData, JudgesResolverData } from "../types";
import {
	clearWizardDraft,
	getDefaultWizardDraft,
	isValidStellarAddress,
	loadWizardDraft,
	saveWizardDraft,
	validateEventDetails,
	validateJudgesResolver,
} from "../wizard-helpers";

describe("Event wizard helpers (U01a)", () => {
	const validJudgeAddress =
		"GBWM3EQRHY6MVR3QFXG4X2Q2C76I43QZTYW3X6L4J7K3Z4F6W2Y6X6L4";
	const validResolverAddress =
		"GC563EQRHY6MVR3QFXG4X2Q2C76I43QZTYW3X6L4J7K3Z4F6W2Y6X6L4";

	describe("isValidStellarAddress", () => {
		it("accepts valid 56-character Ed25519 public keys starting with G", () => {
			expect(isValidStellarAddress(validJudgeAddress)).toBe(true);
			expect(isValidStellarAddress(validResolverAddress)).toBe(true);
		});

		it("rejects addresses with invalid prefixes or lengths", () => {
			expect(
				isValidStellarAddress(
					"CBWM3EQRHY6MVR3QFXG4X2Q2C76I43QZTYW3X6L4J7K3Z4F6W2Y6X6L4",
				),
			).toBe(false); // contract C...
			expect(
				isValidStellarAddress(
					"SBWM3EQRHY6MVR3QFXG4X2Q2C76I43QZTYW3X6L4J7K3Z4F6W2Y6X6L4",
				),
			).toBe(false); // secret S...
			expect(isValidStellarAddress("GBWM3EQRHY6MVR3QFXG4X2Q2C76I43QZ")).toBe(
				false,
			); // too short
			expect(isValidStellarAddress("")).toBe(false);
			expect(isValidStellarAddress("invalid_address_format")).toBe(false);
		});
	});

	describe("validateEventDetails", () => {
		const validDetails: EventDetailsData = {
			name: "Stellar Global Hackathon",
			description: "Decentralized finance challenge",
			registrationCloseDate: "2026-10-01",
			submissionDeadline: "2026-10-15",
			judgingDeadline: "2026-10-22",
		};

		it("passes validation when all fields are present and dates are chronological", () => {
			const res = validateEventDetails(validDetails);
			expect(res.isValid).toBe(true);
			expect(res.errors).toEqual({});
		});

		it("fails validation when required fields are missing", () => {
			const res = validateEventDetails({
				name: "",
				description: "",
				registrationCloseDate: "",
				submissionDeadline: "",
				judgingDeadline: "",
			});
			expect(res.isValid).toBe(false);
			expect(res.errors.name).toBeDefined();
			expect(res.errors.description).toBeDefined();
			expect(res.errors.registrationCloseDate).toBeDefined();
			expect(res.errors.submissionDeadline).toBeDefined();
			expect(res.errors.judgingDeadline).toBeDefined();
		});

		it("catches out-of-order dates between registration close and submission deadline", () => {
			const outOfOrder: EventDetailsData = {
				...validDetails,
				registrationCloseDate: "2026-10-20", // after submission!
				submissionDeadline: "2026-10-15",
			};
			const res = validateEventDetails(outOfOrder);
			expect(res.isValid).toBe(false);
			expect(res.errors.registrationCloseDate).toContain("on or before");
		});

		it("catches out-of-order dates between submission deadline and judging deadline", () => {
			const outOfOrder: EventDetailsData = {
				...validDetails,
				submissionDeadline: "2026-10-25",
				judgingDeadline: "2026-10-20", // before submission!
			};
			const res = validateEventDetails(outOfOrder);
			expect(res.isValid).toBe(false);
			expect(res.errors.judgingDeadline).toContain("on or after");
		});
	});

	describe("validateJudgesResolver", () => {
		it("passes validation with valid judge address and blank resolver (Astrea default)", () => {
			const data: JudgesResolverData = {
				judgeName: "Alice Walker",
				judgeAddress: validJudgeAddress,
				resolverAddress: "",
				useDefaultResolver: true,
			};
			const res = validateJudgesResolver(data);
			expect(res.isValid).toBe(true);
			expect(res.errors).toEqual({});
		});

		it("fails validation when judge address is malformed", () => {
			const data: JudgesResolverData = {
				judgeName: "Alice Walker",
				judgeAddress: "invalid_judge_address",
				resolverAddress: "",
				useDefaultResolver: true,
			};
			const res = validateJudgesResolver(data);
			expect(res.isValid).toBe(false);
			expect(res.errors.judgeAddress).toContain("Invalid Stellar address");
		});

		it("validates custom resolver address when provided", () => {
			const withInvalidResolver: JudgesResolverData = {
				judgeName: "Alice Walker",
				judgeAddress: validJudgeAddress,
				resolverAddress: "invalid_resolver_key",
				useDefaultResolver: false,
			};
			const invalidRes = validateJudgesResolver(withInvalidResolver);
			expect(invalidRes.isValid).toBe(false);
			expect(invalidRes.errors.resolverAddress).toContain(
				"Invalid resolver address",
			);

			const withValidResolver: JudgesResolverData = {
				...withInvalidResolver,
				resolverAddress: validResolverAddress,
			};
			const validRes = validateJudgesResolver(withValidResolver);
			expect(validRes.isValid).toBe(true);
		});
	});

	describe("draft persistence (saveWizardDraft / loadWizardDraft)", () => {
		beforeEach(() => {
			clearWizardDraft();
		});

		it("returns default draft when storage is empty", () => {
			const draft = loadWizardDraft();
			expect(draft.currentStep).toBe(1);
			expect(draft.details.name).toBe("");
			expect(draft.participants.enableCustomQuestions).toBe(false);
		});

		it("saves and reloads draft state accurately", () => {
			const draft = getDefaultWizardDraft();
			draft.details.name = "My Hackathon Draft";
			draft.currentStep = 3;
			draft.judgesResolver.judgeName = "Judge Bob";

			saveWizardDraft(draft);

			const loaded = loadWizardDraft();
			expect(loaded.details.name).toBe("My Hackathon Draft");
			expect(loaded.currentStep).toBe(3);
			expect(loaded.judgesResolver.judgeName).toBe("Judge Bob");
			expect(loaded.lastSavedAt).toBeDefined();
		});
	});
});
