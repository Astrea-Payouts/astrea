const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Primary keys are Postgres UUID columns: a non-UUID string in a query makes
// Postgres throw (22P02) instead of matching nothing, so a route param or
// form field has to pass this before it reaches Prisma.
export function isUuid(value: string): boolean {
	return UUID_PATTERN.test(value);
}
