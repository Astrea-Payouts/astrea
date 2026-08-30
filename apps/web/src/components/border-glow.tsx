"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface BorderGlowProps {
	children: React.ReactNode;
	className?: string;
}

/** React Bits Border Glow — pointer-proximity border on desktop, static on touch. */
export function BorderGlow({ children, className }: BorderGlowProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [pointer, setPointer] = useState({ x: 50, y: 50, active: false });

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: decorative pointer-proximity glow, not an interactive control
		<div
			ref={ref}
			className={cn(
				"group relative rounded-xl border border-white/10 bg-zinc-950/60 p-4 transition-colors",
				className,
			)}
			onMouseMove={(event) => {
				const bounds = ref.current?.getBoundingClientRect();
				if (!bounds) return;
				const x = ((event.clientX - bounds.left) / bounds.width) * 100;
				const y = ((event.clientY - bounds.top) / bounds.height) * 100;
				setPointer({ x, y, active: true });
			}}
			onMouseLeave={() => setPointer((prev) => ({ ...prev, active: false }))}
			style={
				pointer.active
					? {
							backgroundImage: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(255,255,255,0.14), transparent 55%)`,
						}
					: undefined
			}
		>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100",
					pointer.active && "opacity-100",
				)}
				style={
					pointer.active
						? {
								background: `radial-gradient(600px circle at ${pointer.x}% ${pointer.y}%, rgba(255,255,255,0.22), transparent 40%)`,
								mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
								maskComposite: "exclude",
								padding: "1px",
							}
						: undefined
				}
			/>
			<div className="relative z-10">{children}</div>
		</div>
	);
}
