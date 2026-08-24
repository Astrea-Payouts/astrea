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
				"inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground",
				className,
			)}
		>
			<a
				href={explorerUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary hover:underline underline-offset-4"
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
					className="inline-flex size-6 items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
