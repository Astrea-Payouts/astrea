"use client";

import type { ComponentProps } from "react";
import { BorderGlowInView } from "@/components/marketing/border-glow-in-view";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

type ThemedBorderGlowProps = Omit<
	ComponentProps<typeof BorderGlowInView>,
	"backgroundColor"
>;

const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#09090b";

/**
 * BorderGlow with a surface that follows the theme.
 *
 * BorderGlow takes its surface colour as a hex string and works out from it
 * whether the card is light (dark border and soft shadow) or dark (light
 * border and heavy shadow), so it cannot follow a CSS variable and the colour
 * has to be chosen in JS.
 *
 * That choice only exists after hydration, though: the server always renders
 * the default theme. A returning light-mode visitor would therefore get dark
 * cards, with light-mode text on them, until React takes over. The classes
 * below repeat the surface and border in CSS, with `!` to beat the inline
 * style, so the very first paint is already right: the browser resolves
 * `dark:` from the <html> class, which an inline script in <head> sets before
 * paint. Once hydrated, the JS value and the CSS agree.
 */
export function ThemedBorderGlow({
	className,
	...props
}: ThemedBorderGlowProps) {
	const { theme } = useTheme();

	return (
		<BorderGlowInView
			{...props}
			backgroundColor={theme === "light" ? LIGHT_SURFACE : DARK_SURFACE}
			className={cn(
				"!bg-white !border-zinc-200 dark:!bg-[#09090b] dark:!border-white/15",
				className,
			)}
		/>
	);
}
