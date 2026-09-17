/**
 * Repository ownership verification (U18).
 * Pure functions for parsing GitHub repository URLs and validating whether a given
 * GitHub user owns or has write permissions for the repository.
 */

export interface RepoPermissions {
	admin?: boolean;
	push?: boolean;
	pull?: boolean;
}

export interface RepoOwnershipInput {
	userLogin: string;
	repoOwner: string;
	permissions?: RepoPermissions | null;
	isCollaborator?: boolean;
}

export interface RepoOwnershipResult {
	isOwner: boolean;
	reason?: string;
}

const GITHUB_REPO_PATH_REGEX =
	/^\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+?)(?:\.git)?\/?$/;

/**
 * Parses a GitHub repository URL or slug into owner and repo name.
 * Supported formats:
 * - https://github.com/owner/repo
 * - http://github.com/owner/repo/
 * - https://github.com/owner/repo.git
 * - github.com/owner/repo
 */
export function parseGitHubRepoUrl(
	rawUrl: string,
): { owner: string; repo: string } | null {
	if (!rawUrl || typeof rawUrl !== "string") {
		return null;
	}

	const trimmed = rawUrl.trim();
	if (!trimmed) {
		return null;
	}

	// Handle SSH clone URLs (e.g. git@github.com:owner/repo.git)
	const sshMatch = trimmed.match(
		/^git@github\.com:([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+?)(?:\.git)?\/?$/i,
	);
	if (sshMatch?.[1] && sshMatch?.[2]) {
		return { owner: sshMatch[1], repo: sshMatch[2] };
	}

	let urlToParse = trimmed;
	if (!/^https?:\/\//i.test(urlToParse)) {
		urlToParse = `https://${urlToParse}`;
	}

	try {
		const parsed = new URL(urlToParse);
		const host = parsed.hostname.toLowerCase();
		if (host !== "github.com" && host !== "www.github.com") {
			return null;
		}

		const match = parsed.pathname.match(GITHUB_REPO_PATH_REGEX);
		if (!match) {
			return null;
		}

		const owner = match[1];
		const repo = match[2];

		if (!owner || !repo) {
			return null;
		}

		return { owner, repo };
	} catch {
		return null;
	}
}

/**
 * Pure function to check whether a user owns or has write access to a repository.
 * A user satisfies ownership if:
 * 1. Their login matches the repository owner (case-insensitive).
 * 2. Or their repository permissions include `admin` or `push` access.
 * 3. Or they are explicitly flagged as an authorized collaborator.
 */
export function checkRepoOwnership(
	input: RepoOwnershipInput,
): RepoOwnershipResult {
	const user = input.userLogin?.trim() ?? "";
	const owner = input.repoOwner?.trim() ?? "";

	if (!user || !owner) {
		return {
			isOwner: false,
			reason: "Username and repository owner must both be non-empty.",
		};
	}

	if (user.toLowerCase() === owner.toLowerCase()) {
		return { isOwner: true };
	}

	if (input.permissions?.admin === true || input.permissions?.push === true) {
		return { isOwner: true };
	}

	if (input.isCollaborator === true) {
		return { isOwner: true };
	}

	return {
		isOwner: false,
		reason: `GitHub user @${user} does not match repository owner @${owner} and does not have admin/push permissions.`,
	};
}
