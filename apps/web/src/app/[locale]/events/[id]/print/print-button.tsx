"use client";

/**
 * Renders a client-side action button that triggers the browser's print dialog.
 */
export function PrintButton({
	label = "Print / Save PDF (A4)",
}: {
	label?: string;
} = {}) {
	return (
		<button
			type="button"
			onClick={() => {
				if (typeof window !== "undefined") {
					window.print();
				}
			}}
			className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 transition-colors"
		>
			{label}
		</button>
	);
}
