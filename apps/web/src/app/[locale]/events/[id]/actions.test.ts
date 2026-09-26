import { beforeEach, describe, expect, it, vi } from "vitest";

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const WALLET = {
	id: "wallet-1",
	userId: "user-1",
	address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
	email: null,
	usdcTrustlineVerifiedAt: null,
	createdAt: new Date(),
};

const { mockDb, mockSession, mockTrustline, mockRevalidate } = vi.hoisted(
	() => ({
		mockDb: {
			event: { findUnique: vi.fn(), updateMany: vi.fn() },
			teamMember: { findUnique: vi.fn() },
			team: { create: vi.fn() },
			linkedAccount: { findUnique: vi.fn() },
		},
		mockSession: vi.fn(),
		mockTrustline: vi.fn(),
		mockRevalidate: vi.fn(),
	}),
);

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("@/lib/trustline/verify-and-record", () => ({
	verifyAndRecordTrustline: mockTrustline,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));

const { registerTeam, startJudging } = await import("./actions");

const validInput = {
	teamName: "Team Rocket",
	submissionUrl: "https://github.com/example/repo",
};

describe("registerTeam", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "LIVE",
			requireGithub: false,
		});
		mockTrustline.mockResolvedValue(true);
		mockDb.teamMember.findUnique.mockResolvedValue(null);
		mockDb.team.create.mockResolvedValue({ id: "team-1" });
		mockDb.linkedAccount.findUnique.mockResolvedValue(null);
	});

	it("refuses without a session wallet, touching nothing", async () => {
		mockSession.mockResolvedValue(null);

		const res = await registerTeam(EVENT_ID, validInput);

		expect(res).toEqual({ ok: false, code: "notConnected" });
		expect(mockTrustline).not.toHaveBeenCalled();
		expect(mockDb.team.create).not.toHaveBeenCalled();
	});

	it("refuses when the event is not LIVE", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "JUDGING",
		});

		const res = await registerTeam(EVENT_ID, validInput);

		expect(res).toEqual({ ok: false, code: "notLive" });
		expect(mockTrustline).not.toHaveBeenCalled();
		expect(mockDb.team.create).not.toHaveBeenCalled();
	});

	it("refuses with the missing trustline named, before any write", async () => {
		mockTrustline.mockResolvedValue(false);

		const res = await registerTeam(EVENT_ID, validInput);

		expect(res.ok).toBe(false);
		if (res.ok) throw new Error("unreachable");
		expect(res.code).toBe("missingTrustline");
		expect(res.detail).toBe(`USDC:${process.env.USDC_ISSUER as string}`);
		expect(mockTrustline).toHaveBeenCalledWith(WALLET.id, WALLET.address);
		expect(mockDb.teamMember.findUnique).not.toHaveBeenCalled();
		expect(mockDb.team.create).not.toHaveBeenCalled();
	});

	it("refuses when the wallet already belongs to a team on this event", async () => {
		mockDb.teamMember.findUnique.mockResolvedValue({ id: "member-9" });

		const res = await registerTeam(EVENT_ID, validInput);

		expect(res).toEqual({ ok: false, code: "alreadyRegistered" });
		expect(mockDb.teamMember.findUnique).toHaveBeenCalledWith({
			where: { eventId_walletId: { eventId: EVENT_ID, walletId: WALLET.id } },
			select: { id: true },
		});
		expect(mockDb.team.create).not.toHaveBeenCalled();
	});

	it("rejects an empty team name or a non-http submission URL without touching the DB", async () => {
		expect(
			await registerTeam(EVENT_ID, { ...validInput, teamName: "  " }),
		).toEqual({
			ok: false,
			code: "invalidTeamName",
		});
		expect(
			await registerTeam(EVENT_ID, {
				...validInput,
				submissionUrl: "javascript:alert(1)",
			}),
		).toEqual({ ok: false, code: "invalidSubmissionUrl" });
		expect(mockDb.event.findUnique).not.toHaveBeenCalled();
	});

	it("creates Team + single TeamMember with the full share in one nested write", async () => {
		const res = await registerTeam(EVENT_ID, {
			teamName: "  Team Rocket ",
			submissionUrl: "https://github.com/example/repo",
		});

		expect(res).toEqual({ ok: true });
		expect(mockDb.team.create).toHaveBeenCalledTimes(1);
		expect(mockDb.team.create).toHaveBeenCalledWith({
			data: {
				eventId: EVENT_ID,
				name: "Team Rocket",
				submissionUrl: "https://github.com/example/repo",
				submissionVerifiedAt: null,
				members: {
					create: [
						{
							eventId: EVENT_ID,
							walletId: WALLET.id,
							shareBasisPoints: 10000,
							ordinal: 0,
						},
					],
				},
			},
		});
		expect(mockRevalidate).toHaveBeenCalled();
	});

	it("refuses when event requires GitHub but wallet has no linked GitHub account", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "LIVE",
			requireGithub: true,
		});
		mockDb.linkedAccount.findUnique.mockResolvedValue(null);

		const res = await registerTeam(EVENT_ID, validInput);
		expect(res).toEqual({ ok: false, code: "githubRequired" });
		expect(mockDb.team.create).not.toHaveBeenCalled();
	});

	it("refuses when event requires GitHub but submission URL is not a GitHub repo", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "LIVE",
			requireGithub: true,
		});
		mockDb.linkedAccount.findUnique.mockResolvedValue({
			username: "alice",
			provider: "GITHUB",
		});

		const res = await registerTeam(EVENT_ID, {
			...validInput,
			submissionUrl: "https://gitlab.com/alice/project",
		});
		expect(res).toEqual({ ok: false, code: "invalidGithubUrl" });
		expect(mockDb.team.create).not.toHaveBeenCalled();
	});

	it("refuses when event requires GitHub but user does not own the repo", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "LIVE",
			requireGithub: true,
		});
		mockDb.linkedAccount.findUnique.mockResolvedValue({
			username: "alice",
			provider: "GITHUB",
		});

		const res = await registerTeam(EVENT_ID, {
			...validInput,
			submissionUrl: "https://github.com/bob/other-repo",
		});
		expect(res.ok).toBe(false);
		if (res.ok) throw new Error("unreachable");
		expect(res.code).toBe("notRepoOwner");
		expect(mockDb.team.create).not.toHaveBeenCalled();
	});

	it("records submissionVerifiedAt timestamp when event requires GitHub and user owns repo", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "LIVE",
			requireGithub: true,
		});
		mockDb.linkedAccount.findUnique.mockResolvedValue({
			username: "alice",
			provider: "GITHUB",
		});

		const res = await registerTeam(EVENT_ID, {
			teamName: "Alice Team",
			submissionUrl: "https://github.com/alice/my-repo",
		});
		expect(res).toEqual({ ok: true });
		expect(mockDb.team.create).toHaveBeenCalledWith({
			data: {
				eventId: EVENT_ID,
				name: "Alice Team",
				submissionUrl: "https://github.com/alice/my-repo",
				submissionVerifiedAt: expect.any(Date),
				members: {
					create: [
						{
							eventId: EVENT_ID,
							walletId: WALLET.id,
							shareBasisPoints: 10000,
							ordinal: 0,
						},
					],
				},
			},
		});
	});
});

describe("startJudging", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "LIVE",
			organizerWalletId: WALLET.id,
		});
		mockDb.event.updateMany.mockResolvedValue({ count: 1 });
	});

	it("refuses a wallet that is not the organizer", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "LIVE",
			organizerWalletId: "someone-else",
		});

		expect(await startJudging(EVENT_ID)).toEqual({
			ok: false,
			code: "notOrganizer",
		});
		expect(mockDb.event.updateMany).not.toHaveBeenCalled();
	});

	it("only transitions from LIVE", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			id: EVENT_ID,
			status: "CREATED",
			organizerWalletId: WALLET.id,
		});

		expect(await startJudging(EVENT_ID)).toEqual({
			ok: false,
			code: "notLive",
		});
		expect(mockDb.event.updateMany).not.toHaveBeenCalled();
	});

	it("moves LIVE → JUDGING with the status-guarded update", async () => {
		expect(await startJudging(EVENT_ID)).toEqual({ ok: true });
		expect(mockDb.event.updateMany).toHaveBeenCalledWith({
			where: { id: EVENT_ID, status: "LIVE" },
			data: { status: "JUDGING" },
		});
	});

	it("reports a lost race as a transition error instead of throwing", async () => {
		mockDb.event.updateMany.mockResolvedValue({ count: 0 });

		const res = await startJudging(EVENT_ID);

		expect(res.ok).toBe(false);
		if (res.ok) throw new Error("unreachable");
		expect(res.code).toBe("transition");
		expect(res.detail).toMatch(/not in status LIVE/);
	});
});

describe("non-UUID event ids", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSession.mockResolvedValue(WALLET);
	});

	it("registerTeam answers eventNotFound without querying the database", async () => {
		expect(await registerTeam("new", validInput)).toEqual({
			ok: false,
			code: "eventNotFound",
		});
		expect(mockDb.event.findUnique).not.toHaveBeenCalled();
	});

	it("startJudging answers eventNotFound without querying the database", async () => {
		expect(await startJudging("new")).toEqual({
			ok: false,
			code: "eventNotFound",
		});
		expect(mockDb.event.findUnique).not.toHaveBeenCalled();
	});
});
