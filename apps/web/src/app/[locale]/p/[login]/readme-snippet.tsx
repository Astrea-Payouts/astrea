"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { FALLBACK_SITE_URL } from "@/lib/site-url";

interface ReadmeSnippetProps {
	login: string;
	siteUrl?: string;
}

export function ReadmeSnippet({
	login,
	siteUrl = FALLBACK_SITE_URL,
}: ReadmeSnippetProps) {
	const [copied, setCopied] = useState(false);
	const snippet = `[![Astrea](${siteUrl}/card/${login}.svg)](${siteUrl}/p/${login})`;

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(snippet);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy snippet:", err);
		}
	};

	return (
		<div className="space-y-4">
			<div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/60">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<code
						data-testid="readme-snippet-code"
						className="block overflow-x-auto font-mono text-xs text-zinc-800 dark:text-zinc-200"
					>
						{snippet}
					</code>
					<button
						type="button"
						onClick={handleCopy}
						aria-label={copied ? "Snippet copied" : "Copy markdown snippet"}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
					>
						{copied ? (
							<>
								<Check className="size-3.5 text-emerald-500" />
								<span>Copied!</span>
							</>
						) : (
							<>
								<Copy className="size-3.5 opacity-70" />
								<span>Copy snippet</span>
							</>
						)}
					</button>
				</div>
			</div>

			<div className="space-y-1.5">
				<p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
					Card Preview:
				</p>
				{/* biome-ignore lint/performance/noImgElement: dynamic svg card preview */}
				<img
					src={`/card/${login}.svg`}
					alt={`${login}'s participation card`}
					width={480}
					height={160}
					className="max-w-full rounded-xl border border-zinc-200 dark:border-white/10"
				/>
			</div>
		</div>
	);
}
