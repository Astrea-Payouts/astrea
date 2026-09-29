import { qrSvgPath } from "@/lib/qr";

// The QR spec asks for a 4-module light border so scanners can find the
// finder patterns. It is drawn inside the SVG, not left to CSS padding.
const QUIET_ZONE = 4;

export type EventQrCodeLabels = {
	title: string;
	hint: string;
	alt: string;
};

type EventQrCodeProps = {
	/** Canonical public URL of the event. Encoded as-is into the QR code. */
	url: string;
	labels: EventQrCodeLabels;
};

/**
 * Share section for the public event page (U11 / Issue #28): a QR code that
 * deep-links back to the same page, plus the URL in plain text.
 *
 * Server component. The QR is an inline SVG built by `qrSvgPath`, the same
 * generator the OG/display images use (#203), so no client JS or canvas is
 * involved. Modules are always black on white, in both themes: many scanners
 * fail on inverted (light-on-dark) codes.
 */
export function EventQrCode({ url, labels }: EventQrCodeProps) {
	const { path, size } = qrSvgPath(url);
	const box = size + QUIET_ZONE * 2;

	return (
		<section
			aria-labelledby="event-share-title"
			className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 sm:flex-row sm:items-center dark:border-white/10"
		>
			<svg
				role="img"
				aria-label={labels.alt}
				data-testid="event-qr-code"
				viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}
				shapeRendering="crispEdges"
				className="size-40 shrink-0 self-center rounded-lg sm:self-auto"
			>
				<title>{labels.alt}</title>
				<rect
					x={-QUIET_ZONE}
					y={-QUIET_ZONE}
					width={box}
					height={box}
					fill="#ffffff"
				/>
				<path d={path} fill="#000000" />
			</svg>
			<div className="flex min-w-0 flex-col gap-2">
				<h2 id="event-share-title" className="text-lg font-bold">
					{labels.title}
				</h2>
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					{labels.hint}
				</p>
				<a
					href={url}
					className="font-mono text-xs break-all text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
				>
					{url}
				</a>
			</div>
		</section>
	);
}
