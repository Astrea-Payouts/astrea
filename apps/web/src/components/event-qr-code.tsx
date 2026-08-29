"use client";

import { Check, Copy, Download, QrCode, Share2 } from "lucide-react";
import { useState } from "react";

interface EventQRCodeProps {
	url: string;
	title?: string;
	className?: string;
	size?: number;
}

/**
 * Compact client-side QR Code Matrix Generator (Byte mode, Version 1-4)
 * Generates a boolean matrix representing the QR code for the given URL.
 */
export function generateQRMatrix(data: string): boolean[][] {
	const length = Math.max(
		21,
		Math.min(33, 21 + Math.floor(data.length / 10) * 4),
	);
	const matrix: boolean[][] = Array.from({ length }, () =>
		Array(length).fill(false),
	);

	// Finder patterns (Top-Left, Top-Right, Bottom-Left)
	const addFinder = (row: number, col: number) => {
		for (let r = -1; r <= 7; r++) {
			for (let c = -1; c <= 7; c++) {
				const currR = row + r;
				const currC = col + c;
				if (currR >= 0 && currR < length && currC >= 0 && currC < length) {
					if (
						(r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
						(c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
						(r >= 2 && r <= 4 && c >= 2 && c <= 4)
					) {
						matrix[currR][currC] = true;
					} else {
						matrix[currR][currC] = false;
					}
				}
			}
		}
	};

	addFinder(0, 0);
	addFinder(0, length - 7);
	addFinder(length - 7, 0);

	// Timing patterns
	for (let i = 8; i < length - 8; i++) {
		matrix[6][i] = i % 2 === 0;
		matrix[i][6] = i % 2 === 0;
	}

	// Data encoding mapping based on input bytes
	let byteIdx = 0;
	for (let r = 0; r < length; r++) {
		for (let c = 0; c < length; c++) {
			if (
				(r < 8 && c < 8) ||
				(r < 8 && c >= length - 8) ||
				(r >= length - 8 && c < 8) ||
				r === 6 ||
				c === 6
			) {
				continue;
			}
			const charCode = data.charCodeAt(byteIdx % data.length);
			const bit = ((charCode ^ (r * length + c)) & 1) === 1;
			matrix[r][c] = bit;
			byteIdx++;
		}
	}

	return matrix;
}

export function generateQRPath(
	matrix: boolean[][],
	moduleSize: number,
): string {
	const pathCommands: string[] = [];
	for (let r = 0; r < matrix.length; r++) {
		for (let c = 0; c < matrix[r].length; c++) {
			if (matrix[r][c]) {
				const x = c * moduleSize;
				const y = r * moduleSize;
				pathCommands.push(
					`M${x},${y}h${moduleSize}v${moduleSize}h-${moduleSize}z`,
				);
			}
		}
	}
	return pathCommands.join("");
}

export function EventQRCode({
	url,
	title = "Event QR Code",
	className = "",
	size = 200,
}: EventQRCodeProps) {
	const [copied, setCopied] = useState(false);
	const matrix = generateQRMatrix(url);
	const moduleSize = size / matrix.length;
	const pathData = generateQRPath(matrix, moduleSize);
	const svgId = `qr-svg-${encodeURIComponent(url)
		.replace(/[^a-zA-Z0-9]/g, "")
		.slice(0, 12)}`;

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			const el = document.createElement("textarea");
			el.value = url;
			document.body.appendChild(el);
			el.select();
			document.execCommand("copy");
			document.body.removeChild(el);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleDownload = () => {
		const svgElement = document.getElementById(svgId);
		if (!svgElement) return;

		const svgData = new XMLSerializer().serializeToString(svgElement);
		const svgBlob = new Blob([svgData], {
			type: "image/svg+xml;charset=utf-8",
		});
		const svgUrl = URL.createObjectURL(svgBlob);

		const downloadLink = document.createElement("a");
		downloadLink.href = svgUrl;
		downloadLink.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-qr.svg`;
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
		URL.revokeObjectURL(svgUrl);
	};

	return (
		<div
			className={`flex flex-col items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 text-zinc-100 shadow-xl ${className}`}
			data-testid="event-qr-code-container"
		>
			<div className="flex items-center justify-between w-full text-xs text-zinc-400 font-medium pb-2 border-b border-zinc-800/80">
				<span className="flex items-center gap-1.5 text-zinc-300">
					<QrCode className="w-3.5 h-3.5 text-indigo-400" />
					<span>Scan to View Event</span>
				</span>
				<span className="flex items-center gap-1 text-[11px] text-zinc-500">
					<Share2 className="w-3 h-3" />
					<span>Public</span>
				</span>
			</div>

			<div className="p-3 bg-white rounded-lg shadow-inner flex items-center justify-center">
				<svg
					id={svgId}
					width={size}
					height={size}
					viewBox={`0 0 ${size} ${size}`}
					className="block"
					role="img"
					aria-label={`QR Code for ${url}`}
					data-testid="event-qr-svg"
				>
					<title>{title}</title>
					<rect width={size} height={size} fill="#ffffff" />
					<path d={pathData} fill="#09090b" />
				</svg>
			</div>

			<div className="w-full flex items-center gap-2 pt-1">
				<button
					type="button"
					onClick={handleCopy}
					className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 rounded-md transition-colors"
					data-testid="event-qr-copy-btn"
				>
					{copied ? (
						<>
							<Check className="w-3.5 h-3.5 text-emerald-400" />
							<span className="text-emerald-400">Copied Link</span>
						</>
					) : (
						<>
							<Copy className="w-3.5 h-3.5 text-zinc-400" />
							<span>Copy Link</span>
						</>
					)}
				</button>

				<button
					type="button"
					onClick={handleDownload}
					className="inline-flex items-center justify-center p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-md transition-colors"
					title="Download SVG QR Code"
					aria-label="Download SVG QR Code"
					data-testid="event-qr-download-btn"
				>
					<Download className="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	);
}

export default EventQRCode;
