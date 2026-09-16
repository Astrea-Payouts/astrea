export const UNSUPPORTED_ALBEDO_MESSAGE =
	"Albedo does not support SEP-0043 message signing required for verified authentication. Please connect using Freighter, xBull, or Lobstr.";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOptionalEmail(email?: string | null): string | null {
	if (email === undefined || email === null) return null;
	const trimmed = email.trim();
	if (trimmed === "") return null;
	if (!EMAIL_REGEX.test(trimmed)) {
		throw new Error("Invalid email address format");
	}
	return trimmed;
}
