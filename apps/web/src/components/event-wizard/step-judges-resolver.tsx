"use client";

import {
	AlertCircle,
	CheckCircle2,
	Gavel,
	Info,
	Scale,
	ShieldAlert,
	Users,
} from "lucide-react";
import type { JudgesResolverData } from "@/lib/event-wizard/types";
import { isValidStellarAddress } from "@/lib/event-wizard/wizard-helpers";
import { cn } from "@/lib/utils";

export interface StepJudgesResolverProps {
	data: JudgesResolverData;
	onChange: (data: JudgesResolverData) => void;
	errors?: Record<string, string>;
	className?: string;
}

export function StepJudgesResolver({
	data,
	onChange,
	errors = {},
	className,
}: StepJudgesResolverProps) {
	const handleFieldChange = (
		field: keyof JudgesResolverData,
		value: string | boolean,
	) => {
		const nextData = {
			...data,
			[field]: value,
		};
		// Automatically synchronize useDefaultResolver flag based on address value
		if (field === "resolverAddress") {
			nextData.useDefaultResolver = !value || String(value).trim() === "";
		}
		onChange(nextData);
	};

	const isJudgeAddressValid =
		data.judgeAddress.trim() !== "" && isValidStellarAddress(data.judgeAddress);
	const isResolverAddressValid =
		data.resolverAddress.trim() !== "" &&
		isValidStellarAddress(data.resolverAddress);

	return (
		<div
			className={cn(
				"rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur space-y-6 md:p-8",
				className,
			)}
		>
			<div className="flex items-center gap-3">
				<div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
					<Scale className="size-5" />
				</div>
				<div>
					<h3 className="text-lg font-bold text-white">
						Judges & Dispute Resolver
					</h3>
					<p className="text-xs text-zinc-400">
						Designate authorized signers for milestone approvals and dispute
						resolution.
					</p>
				</div>
			</div>

			{/* Multisig Advisory Note */}
			<div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 text-xs text-zinc-300 flex items-start gap-3">
				<Users className="size-4 text-blue-400 shrink-0 mt-0.5" />
				<div>
					<span className="font-semibold text-white block mb-0.5">
						Multisig Panel Guidance
					</span>
					<span>
						The smart contract accepts a single{" "}
						<code className="text-blue-300 font-mono">approver</code> address.
						If you have a multi-person judging committee, provide the public key
						of a shared Stellar multisig account (e.g. 2-of-3 threshold).
					</span>
				</div>
			</div>

			<div className="space-y-4">
				{/* Section 1: Lead Judge */}
				<div className="rounded-xl border border-white/5 bg-black/40 p-4 space-y-4">
					<div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
						<Gavel className="size-3.5" />
						<span>Lead Judge / Committee Public Key</span>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<label
								htmlFor="judge-name"
								className="block text-xs font-medium text-zinc-300"
							>
								Judge / Committee Name <span className="text-red-400">*</span>
							</label>
							<input
								id="judge-name"
								type="text"
								value={data.judgeName}
								onChange={(e) => handleFieldChange("judgeName", e.target.value)}
								placeholder="e.g. Meridian Technical Jury"
								aria-invalid={Boolean(errors.judgeName)}
								className={cn(
									"w-full rounded-xl border bg-black/60 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors",
									errors.judgeName
										? "border-red-500/50 focus:border-red-500"
										: "border-white/10 focus:border-purple-500",
								)}
							/>
							{errors.judgeName && (
								<div className="flex items-center gap-1 text-[11px] text-red-400">
									<AlertCircle className="size-3 shrink-0" />
									<span>{errors.judgeName}</span>
								</div>
							)}
						</div>

						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<label
									htmlFor="judge-address"
									className="block text-xs font-medium text-zinc-300"
								>
									Stellar Public Key <span className="text-red-400">*</span>
								</label>
								{isJudgeAddressValid && (
									<span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
										<CheckCircle2 className="size-3" />
										Valid G... Key
									</span>
								)}
							</div>
							<input
								id="judge-address"
								type="text"
								value={data.judgeAddress}
								onChange={(e) =>
									handleFieldChange("judgeAddress", e.target.value)
								}
								placeholder="G..."
								aria-invalid={Boolean(errors.judgeAddress)}
								className={cn(
									"w-full rounded-xl border bg-black/60 px-3.5 py-2 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors",
									errors.judgeAddress
										? "border-red-500/50 focus:border-red-500"
										: "border-white/10 focus:border-purple-500",
								)}
							/>
							{errors.judgeAddress && (
								<div className="flex items-center gap-1 text-[11px] text-red-400">
									<AlertCircle className="size-3 shrink-0" />
									<span>{errors.judgeAddress}</span>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Section 2: Dispute Resolver (ADR-003) */}
				<div className="rounded-xl border border-white/5 bg-black/40 p-4 space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
							<Scale className="size-3.5" />
							<span>Dispute Resolver (ADR-003)</span>
						</div>
						<span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
							Optional
						</span>
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<label
								htmlFor="resolver-address"
								className="block text-xs font-medium text-zinc-300"
							>
								Custom Resolver Stellar Address
							</label>
							{isResolverAddressValid && (
								<span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
									<CheckCircle2 className="size-3" />
									Valid Resolver Key
								</span>
							)}
						</div>
						<input
							id="resolver-address"
							type="text"
							value={data.resolverAddress}
							onChange={(e) =>
								handleFieldChange("resolverAddress", e.target.value)
							}
							placeholder="Leave blank to use Astrea Default Resolver..."
							aria-invalid={Boolean(errors.resolverAddress)}
							className={cn(
								"w-full rounded-xl border bg-black/60 px-3.5 py-2 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors",
								errors.resolverAddress
									? "border-red-500/50 focus:border-red-500"
									: "border-white/10 focus:border-amber-500",
							)}
						/>
						{errors.resolverAddress && (
							<div className="flex items-center gap-1 text-[11px] text-red-400">
								<AlertCircle className="size-3 shrink-0" />
								<span>{errors.resolverAddress}</span>
							</div>
						)}
					</div>

					{/* ADR-003 / ADR-006 Scope Explainer */}
					<div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-200/90 space-y-1.5">
						<div className="flex items-center gap-1.5 font-semibold text-amber-300">
							<ShieldAlert className="size-3.5 shrink-0" />
							<span>
								{data.useDefaultResolver
									? "Using Astrea Default Resolver"
									: "Custom Resolver Assigned"}
							</span>
						</div>
						<p className="text-[11px] text-zinc-400 leading-relaxed">
							Per ADR-003 and ADR-006, the resolver holds definitive fiduciary
							authority to:
						</p>
						<ul className="list-disc list-inside text-[11px] text-zinc-400 space-y-0.5 pl-1">
							<li>Arbitrate contested deliverables and resolve disputes.</li>
							<li>
								Execute fallback milestone release if appointed judges become
								permanently unresponsive.
							</li>
							<li>
								Co-sign pre-launch emergency withdrawals (requires both
								organizer and resolver signatures).
							</li>
						</ul>
						{data.useDefaultResolver && (
							<div className="pt-1 text-[11px] text-zinc-400 italic flex items-center gap-1">
								<Info className="size-3 text-amber-400" />
								<span>
									Leaving this field blank automatically designates Astrea's
									neutral multi-sig dispute council.
								</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
