// Validates a timezone string against the runtime's own IANA timezone
// database — never a hardcoded list, since that list goes stale as the tz
// database updates independently of this codebase. This is what backs
// Event.timezone (schema.prisma): the on-chain `deadline` is a UTC ledger
// timestamp and `expire_event` is permissionless, so an organizer-entered
// local time needs a real timezone attached to it or the refund path can
// fire against a different instant than they intended.
//
// No callers yet — nothing outside prisma/ references startsAt/endsAt or
// the new registration fields, so there's no event-creation path to wire
// this into.
export function isValidIanaTimeZone(timezone: string): boolean {
	if (typeof timezone !== "string" || timezone.length === 0) {
		return false;
	}
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: timezone });
		return true;
	} catch (err) {
		if (err instanceof RangeError) {
			return false;
		}
		throw err;
	}
}
