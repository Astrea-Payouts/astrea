"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
	checkRepoOwnership,
	parseGitHubRepoUrl,
} from "@/lib/github/repo-ownership";
import { transitionEvent } from "@/lib/state-machines/apply";
import { verifyAndRecordTrustline } from "@/lib/trustline/verify-and-record";
import { getSessionWallet } from "@/lib/wallet/session";

// Server actions are reachable by direct POST, so every one re-checks the
// session and the event state itself — never trusting the page that
// rendered the form.

export type ActionResult =
	| { ok: true }
	| {
			ok: false;
			// Keys under the "EventPage.errors" message namespace, so the page
			// can render them in the viewer's locale; `detail` is verbatim text.
			code:
				| "notConnected"
				| "eventNotFound"
				| "notLive"
				| "missingTrustline"
				| "alreadyRegistered"
				| "invalidTeamName"
				| "invalidSubmissionUrl"
				| "notOrganizer"
				| "transition"
				| "githubRequired"
				| "invalidGithubUrl"
				| "notRepoOwner";
			detail?: string;
	  };

export interface RegisterTeamInput {
	teamName: string;
	submissionUrl: string;
}

const TEAM_NAME_MAX = 80;

function parseSubmissionUrl(raw: string): string | null {
	try {
		const url = new URL(raw.trim());
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		return url.toString();
	} catch {
		return null;
	}
}

// Issue #15, decision 3: registration is web-only, teams of one. The session
// wallet becomes the team's single member with the full share.
export async function registerTeam(
	eventId: string,
	input: RegisterTeamInput,
): Promise<ActionResult> {
	const session = await getSessionWallet();
	if (!session) return { ok: false, code: "notConnected" };

	const teamName = input.teamName.trim();
	if (teamName.length === 0 || teamName.length > TEAM_NAME_MAX) {
		return { ok: false, code: "invalidTeamName" };
	}
	const submissionUrl = parseSubmissionUrl(input.submissionUrl);
	if (!submissionUrl) return { ok: false, code: "invalidSubmissionUrl" };

	const event = await db.event.findUnique({
		where: { id: eventId },
		select: { id: true, status: true, requireGithub: true },
	});
	if (!event) return { ok: false, code: "eventNotFound" };
	if (event.status !== "LIVE") return { ok: false, code: "notLive" };

	let submissionVerifiedAt: Date | null = null;
	if (event.requireGithub) {
		const linkedAccount = await db.linkedAccount.findUnique({
			where: {
				walletId_provider: { walletId: session.id, provider: "GITHUB" },
			},
		});
		if (!linkedAccount) {
			return { ok: false, code: "githubRequired" };
		}

		const parsedRepo = parseGitHubRepoUrl(submissionUrl);
		if (!parsedRepo) {
			return { ok: false, code: "invalidGithubUrl" };
		}

		const ownership = checkRepoOwnership({
			userLogin: linkedAccount.username,
			repoOwner: parsedRepo.owner,
		});
		if (!ownership.isOwner) {
			return {
				ok: false,
				code: "notRepoOwner",
				detail: ownership.reason,
			};
		}
		submissionVerifiedAt = new Date();
	}

	// ADR-004: the trustline check happens before any row is written, and
	// the refusal names the asset so the participant knows what to add.
	const hasTrustline = await verifyAndRecordTrustline(
		session.id,
		session.address,
	);
	if (!hasTrustline) {
		return {
			ok: false,
			code: "missingTrustline",
			detail: `${env.USDC_SYMBOL}:${env.USDC_ISSUER}`,
		};
	}

	const existing = await db.teamMember.findUnique({
		where: { eventId_walletId: { eventId, walletId: session.id } },
		select: { id: true },
	});
	if (existing) return { ok: false, code: "alreadyRegistered" };

	// Nested create — Team and its TeamMember land in one transaction, so a
	// failed member insert (e.g. the unique (eventId, walletId) racing a
	// second submit) leaves no orphan team behind.
	await db.team.create({
		data: {
			eventId,
			name: teamName,
			submissionUrl,
			submissionVerifiedAt,
			members: {
				create: [
					{
						eventId,
						walletId: session.id,
						shareBasisPoints: 10000,
						ordinal: 0,
					},
				],
			},
		},
	});

	revalidatePath(`/[locale]/events/${eventId}`, "page");
	return { ok: true };
}

// Issue #15, decision 4: LIVE → JUDGING is off-chain and organizer-triggered;
// the contract has no judging state and release_reward works from
// InProgress. transitionEvent runs assertEventTransition and the atomic
// status-guarded update.
export async function startJudging(eventId: string): Promise<ActionResult> {
	const session = await getSessionWallet();
	if (!session) return { ok: false, code: "notConnected" };

	const event = await db.event.findUnique({
		where: { id: eventId },
		select: { id: true, status: true, organizerWalletId: true },
	});
	if (!event) return { ok: false, code: "eventNotFound" };
	if (event.organizerWalletId !== session.id) {
		return { ok: false, code: "notOrganizer" };
	}
	if (event.status !== "LIVE") return { ok: false, code: "notLive" };

	try {
		await transitionEvent(eventId, "LIVE", "JUDGING");
	} catch (err) {
		return {
			ok: false,
			code: "transition",
			detail: err instanceof Error ? err.message : String(err),
		};
	}

	revalidatePath(`/[locale]/events/${eventId}`, "page");
	return { ok: true };
}

// FormData adapters for useActionState — the typed functions above are what
// the tests exercise.
export async function registerTeamAction(
	_prev: ActionResult | null,
	formData: FormData,
): Promise<ActionResult> {
	return registerTeam(String(formData.get("eventId") ?? ""), {
		teamName: String(formData.get("teamName") ?? ""),
		submissionUrl: String(formData.get("submissionUrl") ?? ""),
	});
}

export async function startJudgingAction(
	_prev: ActionResult | null,
	formData: FormData,
): Promise<ActionResult> {
	return startJudging(String(formData.get("eventId") ?? ""));
}
