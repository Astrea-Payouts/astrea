/** Path-based SiteHeader default: transparent on homepage hero, solid elsewhere. */
export function resolveHeaderVariant(
	explicitVariant?: "transparent" | "solid",
	pathname = "/",
): "transparent" | "solid" {
	return explicitVariant ?? (pathname === "/" ? "transparent" : "solid");
}
