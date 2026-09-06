"use client";

import {
	AlertCircle,
	CheckCircle2,
	Clock,
	FileText,
	Globe,
	Loader2,
	Send,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { validateSubmissionUrl } from "@/lib/participant/participant-helpers";
import type {
	ParticipantRegistration,
	ParticipantRegistrationState,
	ParticipantSubmission,
	UsdcTrustlineState,
} from "@/lib/participant/types";

interface RegistrationFormProps {
	eventId: string;
	walletAddress?: string | null;
	isRegistrationOpen?: boolean;
	initialRegistration?: ParticipantRegistration | null;
	initialSubmission?: ParticipantSubmission | null;
	trustlineStatus?: UsdcTrustlineState;
	customQuestions?: Array<{
		id: string;
		label: string;
		type: "text" | "single-select" | "yes-no";
		options?: string[];
		required?: boolean;
	}>;
	onRegister?: (registration: ParticipantRegistration) => Promise<void> | void;
	onSubmitProject?: (submission: ParticipantSubmission) => Promise<void> | void;
	className?: string;
}

export function RegistrationForm({
	eventId,
	walletAddress,
	isRegistrationOpen = true,
	initialRegistration = null,
	initialSubmission = null,
	trustlineStatus = "IDLE",
	customQuestions = [],
	onRegister,
	onSubmitProject,
	className = "",
}: RegistrationFormProps) {
	const t = useTranslations("ParticipantRegistration");

	const [regState, setRegState] = useState<ParticipantRegistrationState>(
		initialRegistration ? "REGISTERED" : "IDLE",
	);
	const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
	const [submissionUrl, setSubmissionUrl] = useState(
		initialSubmission?.url || "",
	);
	const [submissionNotes, setSubmissionNotes] = useState(
		initialSubmission?.notes || "",
	);
	const [submission, setSubmission] = useState<ParticipantSubmission | null>(
		initialSubmission,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [urlError, setUrlError] = useState<string | null>(null);
	const [serverError, setServerError] = useState<string | null>(null);

	const handleOneClickRegister = async () => {
		if (!walletAddress) return;
		if (!isRegistrationOpen) {
			setRegState("REGISTRATION_CLOSED");
			return;
		}

		setRegState("REGISTERING");
		setServerError(null);

		try {
			const formattedAnswers = Object.entries(answers).map(([qid, val]) => {
				const q = customQuestions.find((item) => item.id === qid);
				return {
					questionId: qid,
					questionLabel: q?.label || qid,
					value: val,
				};
			});

			const newReg: ParticipantRegistration = {
				eventId,
				walletAddress,
				registeredAt: new Date().toISOString(),
				answers: formattedAnswers.length > 0 ? formattedAnswers : undefined,
			};

			if (onRegister) {
				await onRegister(newReg);
			}

			setRegState("REGISTERED");
		} catch (err) {
			setRegState("ERROR");
			setServerError(
				err instanceof Error ? err.message : "Registration failed",
			);
		}
	};

	const handleProjectSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!walletAddress) return;

		const validation = validateSubmissionUrl(submissionUrl);
		if (!validation.isValid) {
			setUrlError(validation.error || "Invalid submission URL");
			return;
		}
		setUrlError(null);
		setIsSubmitting(true);
		setServerError(null);

		try {
			const newSub: ParticipantSubmission = {
				eventId,
				walletAddress,
				url: submissionUrl.trim(),
				submittedAt: new Date().toISOString(),
				notes: submissionNotes.trim() || undefined,
			};

			if (onSubmitProject) {
				await onSubmitProject(newSub);
			}

			setSubmission(newSub);
		} catch (err) {
			setServerError(err instanceof Error ? err.message : "Submission failed");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isRegistrationOpen) {
		return (
			<div
				className={`rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-sm flex items-start gap-3 ${className}`}
				data-testid="registration-closed"
			>
				<Clock className="size-5 text-red-400 shrink-0 mt-0.5" />
				<div>
					<h4 className="font-semibold text-white">{t("closedTitle")}</h4>
					<p className="text-xs text-zinc-400 mt-1">{t("closedDesc")}</p>
				</div>
			</div>
		);
	}

	if (regState !== "REGISTERED" && !initialRegistration) {
		return (
			<div
				className={`rounded-3xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur flex flex-col gap-6 ${className}`}
				data-testid="registration-card"
			>
				<div>
					<div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-3">
						<Clock className="size-3.5" />
						<span>{t("openBadge")}</span>
					</div>
					<h3 className="text-xl font-bold text-white">{t("cardTitle")}</h3>
					<p className="text-sm text-zinc-400 mt-1">{t("cardDesc")}</p>
				</div>

				{customQuestions.length > 0 && (
					<div className="space-y-4 rounded-2xl bg-black/40 p-4 border border-white/5">
						<h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
							{t("questionsHeader")}
						</h5>
						{customQuestions.map((q) => (
							<div key={q.id} className="space-y-1.5">
								<label
									htmlFor={`q-${q.id}`}
									className="text-xs text-zinc-300 block font-medium"
								>
									{q.label}{" "}
									{q.required && <span className="text-red-400">*</span>}
								</label>
								{q.type === "text" && (
									<input
										id={`q-${q.id}`}
										type="text"
										value={(answers[q.id] as string) || ""}
										onChange={(e) =>
											setAnswers((prev) => ({
												...prev,
												[q.id]: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
										placeholder={t("textPlaceholder")}
									/>
								)}
								{q.type === "yes-no" && (
									<div className="flex items-center gap-4 text-xs text-zinc-300">
										<label className="inline-flex items-center gap-1.5 cursor-pointer">
											<input
												type="radio"
												name={q.id}
												checked={answers[q.id] === true}
												onChange={() =>
													setAnswers((prev) => ({ ...prev, [q.id]: true }))
												}
												className="accent-blue-500"
											/>
											{t("yesOption")}
										</label>
										<label className="inline-flex items-center gap-1.5 cursor-pointer">
											<input
												type="radio"
												name={q.id}
												checked={answers[q.id] === false}
												onChange={() =>
													setAnswers((prev) => ({ ...prev, [q.id]: false }))
												}
												className="accent-blue-500"
											/>
											{t("noOption")}
										</label>
									</div>
								)}
								{q.type === "single-select" && (
									<select
										value={(answers[q.id] as string) || ""}
										onChange={(e) =>
											setAnswers((prev) => ({
												...prev,
												[q.id]: e.target.value,
											}))
										}
										id={`q-${q.id}`}
										className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
									>
										<option value="">{t("selectOptionPlaceholder")}</option>
										{q.options?.map((opt) => (
											<option key={opt} value={opt}>
												{opt}
											</option>
										))}
									</select>
								)}
							</div>
						))}
					</div>
				)}

				{serverError && (
					<div className="rounded-xl bg-red-950/40 border border-red-500/20 p-3 text-xs text-red-300 flex items-center gap-2">
						<AlertCircle className="size-4 shrink-0" />
						<span>{serverError}</span>
					</div>
				)}

				<button
					type="button"
					disabled={!walletAddress || regState === "REGISTERING"}
					onClick={handleOneClickRegister}
					className="w-full rounded-2xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm py-3 px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					data-testid="register-button"
				>
					{regState === "REGISTERING" ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							{t("registeringLabel")}
						</>
					) : (
						<>
							<CheckCircle2 className="size-4 text-emerald-600" />
							{walletAddress
								? t("oneClickRegisterLabel")
								: t("connectWalletToRegister")}
						</>
					)}
				</button>
			</div>
		);
	}

	return (
		<div
			className={`rounded-3xl border border-emerald-500/30 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur flex flex-col gap-6 ${className}`}
			data-testid="registration-confirmed-section"
		>
			<div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
				<div>
					<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 mb-2">
						<CheckCircle2 className="size-3.5" />
						<span>{t("registeredBadge")}</span>
					</div>
					<h3 className="text-xl font-bold text-white">
						{t("registeredTitle")}
					</h3>
					<p className="text-xs text-zinc-400 mt-1">
						{t("registeredSubtitle")}
					</p>
				</div>
			</div>

			<form onSubmit={handleProjectSubmit} className="space-y-4">
				<h4 className="text-sm font-semibold text-white flex items-center gap-2">
					<FileText className="size-4 text-blue-400" />
					{submission ? t("submissionUpdateTitle") : t("submissionTitle")}
				</h4>

				<div>
					<label
						htmlFor="submission-url"
						className="block text-xs text-zinc-300 font-medium mb-1.5"
					>
						{t("submissionUrlLabel")} <span className="text-red-400">*</span>
					</label>
					<div className="relative">
						<Globe className="size-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
						<input
							id="submission-url"
							type="url"
							value={submissionUrl}
							onChange={(e) => setSubmissionUrl(e.target.value)}
							placeholder="https://github.com/org/repo or demo URL"
							className="w-full rounded-xl border border-white/10 bg-zinc-950 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
							required
						/>
					</div>
					{urlError && <p className="text-xs text-red-400 mt-1">{urlError}</p>}
				</div>

				<div>
					<label
						htmlFor="submission-notes"
						className="block text-xs text-zinc-300 font-medium mb-1.5"
					>
						{t("submissionNotesLabel")}
					</label>
					<textarea
						id="submission-notes"
						rows={3}
						value={submissionNotes}
						onChange={(e) => setSubmissionNotes(e.target.value)}
						placeholder={t("submissionNotesPlaceholder")}
						className="w-full rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none resize-none"
					/>
				</div>

				{serverError && (
					<div className="rounded-xl bg-red-950/40 border border-red-500/20 p-3 text-xs text-red-300 flex items-center gap-2">
						<AlertCircle className="size-4 shrink-0" />
						<span>{serverError}</span>
					</div>
				)}

				<div className="flex items-center justify-between gap-4 pt-1">
					<button
						type="submit"
						disabled={isSubmitting || trustlineStatus !== "ACTIVE"}
						className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-5 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						data-testid="submit-project-button"
					>
						{isSubmitting ? (
							<>
								<Loader2 className="size-3.5 animate-spin" />
								{t("submittingLabel")}
							</>
						) : (
							<>
								<Send className="size-3.5" />
								{submission
									? t("updateSubmissionButton")
									: t("submitProjectButton")}
							</>
						)}
					</button>

					{submission && (
						<span className="text-xs text-emerald-400 flex items-center gap-1.5">
							<CheckCircle2 className="size-3.5" />
							{t("submittedTimestamp", {
								time: new Date(submission.submittedAt).toLocaleTimeString(),
							})}
						</span>
					)}
				</div>
			</form>
		</div>
	);
}
