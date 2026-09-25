"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import {
	getExplorerTxUrl,
	type StellarNetwork,
	truncateHash,
} from "@/lib/explorer";
import { cn } from "@/lib/utils";

export interface TxHashLinkProps {
	hash: string;
	network?: StellarNetwork;
	className?: string;
	leadingChars?: number;
	trailingChars?: number;
	showCopy?: boolean;
	showExplorerIcon?: boolean;
}

export function TxHashLink({
	hash,
	network = "testnet",
	className,
	leadingChars = 4,
	trailingChars = 4,
	showCopy = true,
	showExplorerIcon = true,
}: TxHashLinkProps) {
	const [copied, setCopied] = useState(false);

	if (!hash) {
		return null;
	}

	const explorerUrl = getExplorerTxUrl(hash, network);
	const displayedText = truncateHash(hash, leadingChars, trailingChars);

	const handleCopy = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(hash);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy transaction hash:", err);
		}
	};

	return (
		<div
			className={cn(
				// Explicit zinc colors: every host page hardcodes bg-white dark:bg-black and <html> never
				// gets the .dark class, so the theme tokens resolve to their light values.
				"inline-flex items-center gap-1.5 font-mono text-sm text-zinc-600 dark:text-zinc-400",
				className,
			)}
		>
			<a
				href={explorerUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100 transition-colors hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4"
				title={`View transaction on stellar.expert (${network})`}
			>
				<span>{displayedText}</span>
				{showExplorerIcon && (
					<ExternalLink className="size-3.5 opacity-70 transition-opacity hover:opacity-100" />
				)}
			</a>

			{showCopy && (
				<button
					type="button"
					onClick={handleCopy}
					aria-label={
						copied ? "Transaction hash copied" : "Copy transaction hash"
					}
					title={copied ? "Copied!" : "Copy full hash"}
					className="inline-flex size-6 items-center justify-center rounded p-0.5 text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
				>
					{copied ? (
						<Check className="size-3.5 text-green-500" />
					) : (
						<Copy className="size-3.5 opacity-70 transition-opacity hover:opacity-100" />
					)}
				</button>
			)}
		</div>
	);
}
