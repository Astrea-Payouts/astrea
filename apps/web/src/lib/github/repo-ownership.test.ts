import { describe, expect, it } from "vitest";
import { checkRepoOwnership, parseGitHubRepoUrl } from "./repo-ownership";

describe("parseGitHubRepoUrl", () => {
	it("parses valid HTTPS repo URLs", () => {
		expect(
			parseGitHubRepoUrl("https://github.com/alice/stellar-project"),
		).toEqual({
			owner: "alice",
			repo: "stellar-project",
		});
	});

	it("parses valid HTTP and trailing slash URLs", () => {
		expect(parseGitHubRepoUrl("http://github.com/bob/astrea/")).toEqual({
			owner: "bob",
			repo: "astrea",
		});
	});

	it("parses URLs ending with .git", () => {
		expect(
			parseGitHubRepoUrl("https://github.com/Astrea-Payouts/astrea.git"),
		).toEqual({
			owner: "Astrea-Payouts",
			repo: "astrea",
		});
	});

	it("parses URLs without protocol", () => {
		expect(parseGitHubRepoUrl("github.com/charlie/soroban-dapp")).toEqual({
			owner: "charlie",
			repo: "soroban-dapp",
		});
	});

	it("handles www.github.com", () => {
		expect(parseGitHubRepoUrl("https://www.github.com/org/repo")).toEqual({
			owner: "org",
			repo: "repo",
		});
	});

	it("parses SSH clone URLs", () => {
		expect(
			parseGitHubRepoUrl("git@github.com:Astrea-Payouts/astrea.git"),
		).toEqual({
			owner: "Astrea-Payouts",
			repo: "astrea",
		});
		expect(parseGitHubRepoUrl("git@github.com:alice/repo")).toEqual({
			owner: "alice",
			repo: "repo",
		});
	});

	it("rejects non-GitHub domains", () => {
		expect(parseGitHubRepoUrl("https://gitlab.com/alice/repo")).toBeNull();
		expect(parseGitHubRepoUrl("https://bitbucket.org/alice/repo")).toBeNull();
		expect(parseGitHubRepoUrl("https://evilgithub.com/alice/repo")).toBeNull();
	});

	it("rejects malformed paths, empty strings, and deep paths", () => {
		expect(parseGitHubRepoUrl("")).toBeNull();
		expect(parseGitHubRepoUrl("   ")).toBeNull();
		expect(parseGitHubRepoUrl("not a url")).toBeNull();
		expect(parseGitHubRepoUrl("https://github.com/only-owner")).toBeNull();
		expect(
			parseGitHubRepoUrl("https://github.com/owner/repo/pull/123"),
		).toBeNull();
	});
});

describe("checkRepoOwnership", () => {
	it("validates direct owner match (case-insensitive)", () => {
		const result = checkRepoOwnership({
			userLogin: "Rodrigoue9",
			repoOwner: "rodrigoue9",
		});
		expect(result.isOwner).toBe(true);
		expect(result.reason).toBeUndefined();
	});

	it("approves when user has admin permissions on org/other repo", () => {
		const result = checkRepoOwnership({
			userLogin: "Rodrigoue9",
			repoOwner: "Astrea-Payouts",
			permissions: { admin: true, push: true, pull: true },
		});
		expect(result.isOwner).toBe(true);
	});

	it("approves when user has push permissions", () => {
		const result = checkRepoOwnership({
			userLogin: "Rodrigoue9",
			repoOwner: "OpenAO-Team",
			permissions: { admin: false, push: true, pull: true },
		});
		expect(result.isOwner).toBe(true);
	});

	it("approves when user is explicitly marked as collaborator", () => {
		const result = checkRepoOwnership({
			userLogin: "Rodrigoue9",
			repoOwner: "ThirdPartyOwner",
			isCollaborator: true,
		});
		expect(result.isOwner).toBe(true);
	});

	it("refuses when user only has read/pull permissions", () => {
		const result = checkRepoOwnership({
			userLogin: "Rodrigoue9",
			repoOwner: "AnotherDev",
			permissions: { admin: false, push: false, pull: true },
		});
		expect(result.isOwner).toBe(false);
		expect(result.reason).toContain("does not match repository owner");
	});

	it("refuses when user does not own and has no permissions", () => {
		const result = checkRepoOwnership({
			userLogin: "Rodrigoue9",
			repoOwner: "stranger",
		});
		expect(result.isOwner).toBe(false);
		expect(result.reason).toBeDefined();
	});

	it("refuses empty or whitespace usernames or repo owners", () => {
		expect(
			checkRepoOwnership({
				userLogin: "",
				repoOwner: "owner",
			}).isOwner,
		).toBe(false);

		expect(
			checkRepoOwnership({
				userLogin: "user",
				repoOwner: "   ",
			}).isOwner,
		).toBe(false);
	});
});
