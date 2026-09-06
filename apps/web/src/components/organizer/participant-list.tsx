"use client";

import {
	AlertCircle,
	Check,
	CheckCircle2,
	Copy,
	ExternalLink,
	Search,
	ShieldCheck,
	Users,
} from "lucide-react";
import { useState } from "react";
import type { OrganizerParticipant } from "@/lib/organizer/types";
import { cn } from "@/lib/utils";

export interface ParticipantListProps {
	participants: OrganizerParticipant[];
	minRequired?: number;
	className?: string;
}

export function ParticipantList({
	participants,
	minRequired = 1,
	className,
}: ParticipantListProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const filteredParticipants = participants.filter((p) => {
		const q = searchQuery.toLowerCase();
		return (
			p.name.toLowerCase().includes(q) ||
			p.walletAddress.toLowerCase().includes(q)
		);
	});

	const trustlineCount = participants.filter((p) => p.hasTrustline).length;

	const handleCopy = async (id: string, text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedId(id);
			setTimeout(() => setCopiedId(null), 2000);
		} catch (err) {
			console.error("Failed to copy wallet address:", err);
		}
	};

	return (
		<div
			className={cn(
				"rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur md:p-8",
				className,
			)}
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Users className="size-5 text-blue-400" />
						<h3 className="text-lg font-bold text-white">
							Registered Participants
						</h3>
					</div>
					<p className="mt-1 text-xs text-zinc-400">
						Read-only participant registry. Payout assignment & judging happen
						in the Judge Panel.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
					<div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-zinc-300">
						<span>Total:</span>
						<span className="text-white">{participants.length}</span>
						{minRequired > 0 && (
							<span className="text-zinc-500">/ {minRequired} min</span>
						)}
					</div>
					<div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-400">
						<ShieldCheck className="size-3.5" />
						<span>{trustlineCount} Trustline Ready</span>
					</div>
				</div>
			</div>

			<div className="mt-6 relative">
				<Search className="absolute left-3 top-2.5 size-4 text-zinc-500" />
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Search participants by name or wallet address..."
					className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<div className="mt-4 overflow-x-auto">
				{filteredParticipants.length === 0 ? (
					<div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
						<Users className="mx-auto size-8 text-zinc-600" />
						<p className="mt-2 text-sm text-zinc-400">
							{searchQuery
								? "No participants match your search."
								: "No participants registered yet."}
						</p>
					</div>
				) : (
					<table className="w-full text-left text-sm text-zinc-300">
						<thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
							<tr>
								<th scope="col" className="py-3 px-4">
									Participant
								</th>
								<th scope="col" className="py-3 px-4">
									Stellar Wallet
								</th>
								<th scope="col" className="py-3 px-4">
									Trustline
								</th>
								<th scope="col" className="py-3 px-4 text-right">
									Registered Date
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5 font-mono text-xs">
							{filteredParticipants.map((p) => {
								const truncatedWallet = `${p.walletAddress.slice(0, 6)}...${p.walletAddress.slice(-6)}`;
								const explorerUrl = `https://stellar.expert/explorer/testnet/account/${p.walletAddress}`;
								return (
									<tr
										key={p.id}
										className="hover:bg-white/[0.02] transition-colors"
									>
										<td className="py-3 px-4 font-sans font-medium text-white">
											<div>{p.name}</div>
											{p.answers && Object.keys(p.answers).length > 0 && (
												<div className="mt-1 flex flex-wrap gap-1 text-[11px] font-mono text-zinc-500">
													{Object.entries(p.answers).map(([key, val]) => (
														<span
															key={key}
															className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-zinc-400 border border-white/5"
														>
															{key}: {val}
														</span>
													))}
												</div>
											)}
										</td>
										<td className="py-3 px-4">
											<div className="inline-flex items-center gap-1.5">
												<span>{truncatedWallet}</span>
												<button
													type="button"
													onClick={() => handleCopy(p.id, p.walletAddress)}
													aria-label={
														copiedId === p.id
															? "Copied wallet address"
															: "Copy wallet address"
													}
													className="rounded p-1 text-zinc-500 hover:text-white transition-colors"
												>
													{copiedId === p.id ? (
														<Check className="size-3.5 text-emerald-400" />
													) : (
														<Copy className="size-3.5" />
													)}
												</button>
												<a
													href={explorerUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="rounded p-1 text-zinc-500 hover:text-white transition-colors"
													title="View on Stellar Expert"
												>
													<ExternalLink className="size-3.5" />
												</a>
											</div>
										</td>
										<td className="py-3 px-4 font-sans">
											{p.hasTrustline ? (
												<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
													<CheckCircle2 className="size-3" />
													USDC Ready
												</span>
											) : (
												<span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
													<AlertCircle className="size-3" />
													Pending
												</span>
											)}
										</td>
										<td className="py-3 px-4 text-right text-zinc-500 font-sans">
											{new Date(p.registeredAt).toLocaleDateString(undefined, {
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
