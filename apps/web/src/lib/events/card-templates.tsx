import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CSSProperties, ReactElement } from "react";
import { truncateHash } from "../explorer";
import { qrSvgPath } from "../qr";
import type { CardWinner, EventCardModel } from "./card-model";

/**
 * Loads the local Inter Regular TTF font buffer for Satori / next/og image rendering.
 */
export async function loadCardFont(): Promise<Buffer | null> {
	const candidates = [
		join(
			/*turbopackIgnore: true*/ process.cwd(),
			"src/assets/fonts/Inter-Regular.ttf",
		),
		join(
			/*turbopackIgnore: true*/ process.cwd(),
			"apps/web/src/assets/fonts/Inter-Regular.ttf",
		),
	];

	for (const path of candidates) {
		try {
			const buf = await readFile(path);
			return buf;
		} catch {
			// Try next candidate
		}
	}
	return null;
}

const BASE_CONTAINER_STYLE: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	width: "1200px",
	height: "630px",
	backgroundColor: "#050507",
	color: "#ffffff",
	padding: "48px 56px",
	fontFamily: "Inter, sans-serif",
	boxSizing: "border-box",
	justifyContent: "space-between",
};

export interface EventCardLabels {
	genericTitle?: string;
	genericSubtitle?: string;
	builtOnStellar?: string;
	registrationsOpen?: string;
	registrationsClosed?: string;
	judgingInProgress?: string;
	liveCompetition?: string;
	lockedPrizePool?: string;
	escrowAssurance?: string;
	verifiableOnStellar?: string;
	deadline?: string;
	organizer?: string;
	judge?: string;
	judges?: string;
	teamsRegistered?: string;
	teamsRegisteredDisplay?: string;
	completedVerifiedPayouts?: string;
	completedPayoutsPending?: string;
	total?: string;
	place?: string;
	payout?: string;
	moreWinnersPaid?: (count: number) => string;
	moreWinnersPending?: (count: number) => string;
	allPayoutsVerified?: string;
	payoutsPending?: string;
	scanToViewAndRegister?: string;
	scanToFollowJudging?: string;
	judgingDeadline?: string;
	securedByStellar?: string;
}

export const DEFAULT_CARD_LABELS: Required<EventCardLabels> = {
	genericTitle: "Escrow-Backed Prize Payouts",
	genericSubtitle:
		"Smart-contract prize pools on Stellar. Auditable, automated, non-custodial.",
	builtOnStellar: "Built on Stellar Soroban",
	registrationsOpen: "REGISTRATIONS OPEN",
	registrationsClosed: "REGISTRATIONS CLOSED",
	judgingInProgress: "JUDGING IN PROGRESS",
	liveCompetition: "LIVE COMPETITION",
	lockedPrizePool: "LOCKED ON-CHAIN PRIZE POOL",
	escrowAssurance: "Escrow Assurance",
	verifiableOnStellar: "Verifiable on Stellar Soroban",
	deadline: "Deadline",
	organizer: "Organizer",
	judge: "Judge",
	judges: "Judges",
	teamsRegistered: "teams registered",
	teamsRegisteredDisplay: "Teams Registered",
	completedVerifiedPayouts: "COMPLETED • VERIFIED PAYOUTS",
	completedPayoutsPending: "COMPLETED • PAYOUTS PENDING",
	total: "Total:",
	place: "PLACE",
	payout: "✓ Payout:",
	moreWinnersPaid: (count: number) =>
		`+${count} more winner${count > 1 ? "s" : ""} paid on-chain`,
	moreWinnersPending: (count: number) =>
		`+${count} more winner${count > 1 ? "s" : ""} pending payout`,
	allPayoutsVerified: "All payouts verified on Stellar",
	payoutsPending: "Payouts pending on-chain confirmation",
	scanToViewAndRegister: "Scan to view & register",
	scanToFollowJudging: "Scan to follow judging",
	judgingDeadline: "Judging Deadline",
	securedByStellar: "Secured by Stellar Soroban Smart Contract Escrow",
};

/**
 * Loads translated card labels for the given locale using next-intl.
 */
export async function getCardLabels(
	locale: string,
): Promise<Required<EventCardLabels>> {
	try {
		const { getTranslations } = await import("next-intl/server");
		const t = await getTranslations({ locale, namespace: "EventCard" });
		return {
			genericTitle: t("genericTitle"),
			genericSubtitle: t("genericSubtitle"),
			builtOnStellar: t("builtOnStellar"),
			registrationsOpen: t("registrationsOpen"),
			registrationsClosed: t("registrationsClosed"),
			judgingInProgress: t("judgingInProgress"),
			liveCompetition: t("liveCompetition"),
			lockedPrizePool: t("lockedPrizePool"),
			escrowAssurance: t("escrowAssurance"),
			verifiableOnStellar: t("verifiableOnStellar"),
			deadline: t("deadline"),
			organizer: t("organizer"),
			judge: t("judge"),
			judges: t("judges"),
			teamsRegistered: t("teamsRegistered"),
			teamsRegisteredDisplay: t("teamsRegisteredDisplay"),
			completedVerifiedPayouts: t("completedVerifiedPayouts"),
			completedPayoutsPending: t("completedPayoutsPending"),
			total: t("total"),
			place: t("place"),
			payout: t("payout"),
			moreWinnersPaid: (count: number) => t("moreWinnersPaid", { count }),
			moreWinnersPending: (count: number) => t("moreWinnersPending", { count }),
			allPayoutsVerified: t("allPayoutsVerified"),
			payoutsPending: t("payoutsPending"),
			scanToViewAndRegister: t("scanToViewAndRegister"),
			scanToFollowJudging: t("scanToFollowJudging"),
			judgingDeadline: t("judgingDeadline"),
			securedByStellar: t("securedByStellar"),
		};
	} catch {
		return DEFAULT_CARD_LABELS;
	}
}

/**
 * Renders the fallback generic Astrea brand card when an event is draft or has no verifiable money.
 */
export function GenericCard({
	labels,
}: {
	labels?: EventCardLabels;
} = {}): ReactElement {
	const l = { ...DEFAULT_CARD_LABELS, ...labels };
	return (
		<div
			style={{
				...BASE_CONTAINER_STYLE,
				justifyContent: "center",
				alignItems: "center",
				textAlign: "center",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "12px",
					marginBottom: "24px",
				}}
			>
				<div
					style={{
						width: "16px",
						height: "16px",
						borderRadius: "9999px",
						backgroundColor: "#10b981",
					}}
				/>
				<span
					style={{
						fontSize: "24px",
						fontWeight: 700,
						letterSpacing: "0.2em",
						color: "#ffffff",
					}}
				>
					ASTREA
				</span>
			</div>
			<div
				style={{
					display: "flex",
					fontSize: "52px",
					fontWeight: 800,
					color: "#ffffff",
					marginBottom: "16px",
					lineHeight: 1.1,
				}}
			>
				{l.genericTitle}
			</div>
			<div
				style={{
					display: "flex",
					fontSize: "24px",
					color: "#a1a1aa",
					marginBottom: "32px",
				}}
			>
				{l.genericSubtitle}
			</div>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: "8px 20px",
					borderRadius: "9999px",
					backgroundColor: "#18181b",
					border: "1px solid #27272a",
					fontSize: "16px",
					color: "#34d399",
				}}
			>
				{l.builtOnStellar}
			</div>
		</div>
	);
}

/**
 * Renders the open/live/judging event social preview card showing the locked on-chain prize pool.
 */
export function OpenEventCard({
	model,
	labels,
}: {
	model: EventCardModel;
	labels?: EventCardLabels;
}): ReactElement {
	const l = { ...DEFAULT_CARD_LABELS, ...labels };
	const isJudging = model.status === "JUDGING";

	let statusLabel = l.registrationsOpen;
	let statusBg = "#064e3b";
	let statusColor = "#34d399";

	if (isJudging) {
		statusLabel = l.judgingInProgress;
		statusBg = "#3b0764";
		statusColor = "#c084fc";
	} else if (model.isRegistrationClosed) {
		statusLabel = l.registrationsClosed;
		statusBg = "#27272a";
		statusColor = "#a1a1aa";
	}

	return (
		<div style={BASE_CONTAINER_STYLE}>
			{/* Top Bar */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					width: "100%",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<div
						style={{
							width: "12px",
							height: "12px",
							borderRadius: "9999px",
							backgroundColor: "#10b981",
						}}
					/>
					<span
						style={{
							fontSize: "20px",
							fontWeight: 700,
							letterSpacing: "0.15em",
							color: "#ffffff",
						}}
					>
						ASTREA
					</span>
				</div>
				<div
					style={{
						display: "flex",
						padding: "6px 16px",
						borderRadius: "9999px",
						backgroundColor: statusBg,
						color: statusColor,
						fontSize: "14px",
						fontWeight: 700,
						letterSpacing: "0.05em",
					}}
				>
					{statusLabel}
				</div>
			</div>

			{/* Main Content */}
			<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
				<div
					style={{
						display: "flex",
						fontSize: "46px",
						fontWeight: 800,
						color: "#ffffff",
						lineHeight: 1.15,
						maxHeight: "110px",
						overflow: "hidden",
					}}
				>
					{model.name}
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "24px",
						backgroundColor: "#09090b",
						border: "1px solid #10b98140",
						borderRadius: "16px",
						padding: "20px 28px",
					}}
				>
					<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
						<span
							style={{
								fontSize: "14px",
								color: "#a1a1aa",
								fontWeight: 600,
								letterSpacing: "0.05em",
							}}
						>
							{l.lockedPrizePool}
						</span>
						<div
							style={{ display: "flex", alignItems: "baseline", gap: "8px" }}
						>
							<span
								style={{
									fontSize: "44px",
									fontWeight: 900,
									color: "#34d399",
								}}
							>
								{model.prizePool.amount}
							</span>
							<span
								style={{
									fontSize: "22px",
									fontWeight: 700,
									color: "#10b981",
								}}
							>
								{model.prizePool.asset}
							</span>
						</div>
					</div>
					<div
						style={{
							display: "flex",
							height: "48px",
							width: "1px",
							backgroundColor: "#27272a",
							margin: "0 8px",
						}}
					/>
					<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
						<span style={{ fontSize: "13px", color: "#71717a" }}>
							{l.escrowAssurance}
						</span>
						<span
							style={{
								fontSize: "16px",
								fontWeight: 600,
								color: "#e4e4e7",
							}}
						>
							{l.verifiableOnStellar}
						</span>
					</div>
					{model.formattedDeadline ? (
						<>
							<div
								style={{
									display: "flex",
									height: "48px",
									width: "1px",
									backgroundColor: "#27272a",
									margin: "0 8px",
								}}
							/>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "4px",
								}}
							>
								<span style={{ fontSize: "13px", color: "#71717a" }}>
									{l.deadline}
								</span>
								<span
									style={{
										fontSize: "16px",
										fontWeight: 600,
										color: "#e4e4e7",
									}}
								>
									{model.formattedDeadline}
								</span>
							</div>
						</>
					) : null}
				</div>
			</div>

			{/* Bottom Meta */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					borderTop: "1px solid #1f1f23",
					paddingTop: "20px",
					fontSize: "15px",
					color: "#a1a1aa",
				}}
			>
				<div style={{ display: "flex", gap: "28px" }}>
					<span>{`${l.organizer}: ${model.organizer}`}</span>
					{model.judges.length > 0 ? (
						<span>
							{`${model.judges.length > 1 ? l.judges : l.judge}: ${model.judges.slice(0, 2).join(", ")}${model.judges.length > 2 ? ` +${model.judges.length - 2}` : ""}`}
						</span>
					) : null}
				</div>
				<div style={{ display: "flex", gap: "16px" }}>
					<span>{`${model.teamsRegistered} ${l.teamsRegistered}`}</span>
				</div>
			</div>
		</div>
	);
}

/**
 * Renders an individual winner card for social previews (hero, standard, or compact grid).
 */
function WinnerCard({
	winner,
	isHero = false,
	isCompact = false,
	labels,
}: {
	winner: CardWinner;
	isHero?: boolean;
	isCompact?: boolean;
	labels?: EventCardLabels;
}): ReactElement {
	const l = { ...DEFAULT_CARD_LABELS, ...labels };
	const rankColors: Record<
		number,
		{ text: string; bg: string; border: string }
	> = {
		1: { text: "#fbbf24", bg: "#451a03", border: "#f59e0b" },
		2: { text: "#e4e4e7", bg: "#27272a", border: "#71717a" },
		3: { text: "#fdba74", bg: "#431407", border: "#ea580c" },
	};

	const rankMeta = rankColors[winner.rank] ?? {
		text: "#a1a1aa",
		bg: "#18181b",
		border: "#27272a",
	};

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				flex: isCompact ? "0 0 32%" : 1,
				backgroundColor: "#0d0d11",
				border: `1px solid ${isHero ? "#10b98160" : rankMeta.border}`,
				borderRadius: "16px",
				padding: isHero ? "28px 32px" : isCompact ? "12px 16px" : "18px 20px",
				justifyContent: "space-between",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: isCompact ? "4px" : "8px",
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<span
						style={{
							padding: "4px 12px",
							borderRadius: "9999px",
							backgroundColor: rankMeta.bg,
							color: rankMeta.text,
							fontSize: isHero ? "15px" : isCompact ? "11px" : "13px",
							fontWeight: 800,
						}}
					>
						#{winner.rank} {l.place}
					</span>
					<span
						style={{
							fontSize: isHero ? "26px" : isCompact ? "16px" : "20px",
							fontWeight: 900,
							color: "#34d399",
						}}
					>
						{winner.amount} {winner.asset}
					</span>
				</div>

				<div
					style={{
						display: "flex",
						fontSize: isHero ? "30px" : isCompact ? "16px" : "20px",
						fontWeight: 800,
						color: "#ffffff",
						marginTop: "4px",
					}}
				>
					{winner.teamName}
				</div>

				{winner.members.length > 0 ? (
					<div
						style={{
							display: "flex",
							fontSize: isHero ? "16px" : isCompact ? "11px" : "13px",
							color: "#a1a1aa",
						}}
					>
						{winner.members.slice(0, 3).join(" • ")}
						{winner.members.length > 3 ? ` +${winner.members.length - 3}` : ""}
					</div>
				) : null}
			</div>

			{winner.txHash ? (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "6px",
						fontSize: isCompact ? "11px" : "12px",
						color: "#71717a",
						marginTop: isCompact ? "8px" : "12px",
						borderTop: "1px solid #1f1f23",
						paddingTop: isCompact ? "6px" : "8px",
					}}
				>
					<span style={{ color: "#10b981" }}>{l.payout}</span>
					<span style={{ fontFamily: "monospace" }}>
						{truncateHash(winner.txHash, 6, 6)}
					</span>
				</div>
			) : null}
		</div>
	);
}

/**
 * Renders the completed-event winners social card (1 hero, 2-3 podium row, or 4+ compact multi-winner grid).
 */
export function WinnersEventCard({
	model,
	labels,
}: {
	model: EventCardModel;
	labels?: EventCardLabels;
}): ReactElement {
	const l = { ...DEFAULT_CARD_LABELS, ...labels };
	const winnersCount = model.winners.length;
	const isHero = winnersCount === 1;
	const isMultiGrid = winnersCount >= 4;
	const visibleLimit = isMultiGrid ? 6 : 3;
	const visibleWinners = model.winners.slice(0, visibleLimit);
	const remainingCount = Math.max(0, winnersCount - visibleLimit);
	const omittedWinners = model.winners.slice(visibleLimit);
	const allOmittedPaid =
		omittedWinners.length > 0 && omittedWinners.every((w) => Boolean(w.txHash));

	const allPayoutsVerified =
		winnersCount > 0 && model.winners.every((w) => Boolean(w.txHash));

	return (
		<div style={BASE_CONTAINER_STYLE}>
			{/* Header */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					width: "100%",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<div
						style={{
							width: "12px",
							height: "12px",
							borderRadius: "9999px",
							backgroundColor: "#10b981",
						}}
					/>
					<span
						style={{
							fontSize: "20px",
							fontWeight: 700,
							letterSpacing: "0.15em",
							color: "#ffffff",
						}}
					>
						ASTREA
					</span>
				</div>
				<div
					style={{
						display: "flex",
						padding: "6px 16px",
						borderRadius: "9999px",
						backgroundColor: allPayoutsVerified ? "#064e3b" : "#3b0764",
						color: allPayoutsVerified ? "#34d399" : "#c084fc",
						fontSize: "14px",
						fontWeight: 700,
						letterSpacing: "0.05em",
					}}
				>
					{allPayoutsVerified
						? l.completedVerifiedPayouts
						: l.completedPayoutsPending}
				</div>
			</div>

			{/* Event Title & Total */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "baseline",
					gap: "24px",
				}}
			>
				<div
					style={{
						display: "flex",
						fontSize: "36px",
						fontWeight: 800,
						color: "#ffffff",
						lineHeight: 1.2,
					}}
				>
					{model.name}
				</div>
				<div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
					<span style={{ fontSize: "14px", color: "#a1a1aa" }}>{l.total}</span>
					<span
						style={{
							fontSize: "24px",
							fontWeight: 800,
							color: "#34d399",
						}}
					>
						{model.prizePool.amount} {model.prizePool.asset}
					</span>
				</div>
			</div>

			{/* Dynamic Winners Section */}
			{isHero ? (
				<div style={{ display: "flex", width: "100%" }}>
					<WinnerCard winner={model.winners[0]} isHero={true} labels={l} />
				</div>
			) : (
				<div
					style={{
						display: "flex",
						flexWrap: isMultiGrid ? "wrap" : "nowrap",
						gap: isMultiGrid ? "12px" : "16px",
						width: "100%",
						boxSizing: "border-box",
					}}
				>
					{visibleWinners.map((winner) => (
						<WinnerCard
							key={winner.rank}
							winner={winner}
							isCompact={isMultiGrid}
							labels={l}
						/>
					))}
				</div>
			)}

			{/* Footer / More Winners Badge */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					borderTop: "1px solid #1f1f23",
					paddingTop: "16px",
					fontSize: "14px",
					color: "#71717a",
				}}
			>
				<span>{`${l.organizer}: ${model.organizer}`}</span>
				{remainingCount > 0 ? (
					<div
						style={{
							display: "flex",
							padding: "4px 12px",
							borderRadius: "9999px",
							backgroundColor: "#18181b",
							color: "#a1a1aa",
							fontSize: "13px",
							fontWeight: 600,
						}}
					>
						{allOmittedPaid
							? l.moreWinnersPaid(remainingCount)
							: l.moreWinnersPending(remainingCount)}
					</div>
				) : allPayoutsVerified ? (
					<span style={{ color: "#34d399" }}>{l.allPayoutsVerified}</span>
				) : (
					<span style={{ color: "#c084fc" }}>{l.payoutsPending}</span>
				)}
			</div>
		</div>
	);
}

/**
 * Renders the 1920x1080 venue/projector display card including a QR code to the canonical event URL.
 */
export function DisplayEventCard({
	model,
	canonicalUrl,
	labels,
}: {
	model: EventCardModel;
	canonicalUrl: string;
	labels?: EventCardLabels;
}): ReactElement {
	const l = { ...DEFAULT_CARD_LABELS, ...labels };
	const qr = qrSvgPath(canonicalUrl);
	const isJudging = model.status === "JUDGING";

	return (
		<div
			style={{
				display: "flex",
				width: "1920px",
				height: "1080px",
				backgroundColor: "#050507",
				color: "#ffffff",
				padding: "80px 100px",
				fontFamily: "Inter, sans-serif",
				boxSizing: "border-box",
				justifyContent: "space-between",
				alignItems: "center",
			}}
		>
			{/* Left Column: Event details */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					flex: 1.2,
					height: "100%",
					justifyContent: "space-between",
					paddingRight: "60px",
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
						<div
							style={{
								width: "20px",
								height: "20px",
								borderRadius: "9999px",
								backgroundColor: "#10b981",
							}}
						/>
						<span
							style={{
								fontSize: "32px",
								fontWeight: 800,
								letterSpacing: "0.2em",
								color: "#ffffff",
							}}
						>
							ASTREA
						</span>
						<div
							style={{
								display: "flex",
								padding: "8px 20px",
								borderRadius: "9999px",
								backgroundColor: isJudging ? "#3b0764" : "#064e3b",
								color: isJudging ? "#c084fc" : "#34d399",
								fontSize: "18px",
								fontWeight: 700,
								letterSpacing: "0.05em",
								marginLeft: "20px",
							}}
						>
							{isJudging ? l.judgingInProgress : l.liveCompetition}
						</div>
					</div>

					<div
						style={{
							display: "flex",
							fontSize: "68px",
							fontWeight: 900,
							color: "#ffffff",
							lineHeight: 1.15,
							maxHeight: "240px",
							overflow: "hidden",
							marginTop: "20px",
						}}
					>
						{model.name}
					</div>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "16px",
						backgroundColor: "#09090b",
						border: "2px solid #10b98160",
						borderRadius: "24px",
						padding: "36px 48px",
					}}
				>
					<span
						style={{
							fontSize: "20px",
							color: "#a1a1aa",
							fontWeight: 700,
							letterSpacing: "0.1em",
						}}
					>
						{l.lockedPrizePool}
					</span>
					<div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
						<span
							style={{
								fontSize: "76px",
								fontWeight: 900,
								color: "#34d399",
							}}
						>
							{model.prizePool.amount}
						</span>
						<span
							style={{
								fontSize: "36px",
								fontWeight: 700,
								color: "#10b981",
							}}
						>
							{model.prizePool.asset}
						</span>
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span style={{ fontSize: "20px", color: "#71717a" }}>
							{l.securedByStellar}
						</span>
						{model.formattedDeadline ? (
							<span
								style={{
									fontSize: "20px",
									fontWeight: 700,
									color: "#e4e4e7",
								}}
							>
								{`${l.judgingDeadline}: `}
								{model.formattedDeadline}
							</span>
						) : null}
					</div>
				</div>

				<div
					style={{
						display: "flex",
						gap: "40px",
						fontSize: "22px",
						color: "#a1a1aa",
					}}
				>
					<span>
						{model.teamsRegistered}
						{` ${l.teamsRegisteredDisplay}`}
					</span>
					<span>
						{`${l.organizer}: `}
						{model.organizer}
					</span>
				</div>
			</div>

			{/* Right Column: Large QR code */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					flex: 0.8,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#0d0d12",
					border: "1px solid #27272a",
					borderRadius: "32px",
					padding: "48px",
				}}
			>
				<div
					style={{
						display: "flex",
						backgroundColor: "#ffffff",
						padding: "24px",
						borderRadius: "24px",
						boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
					}}
				>
					<svg
						viewBox={`0 0 ${qr.size} ${qr.size}`}
						width="380"
						height="380"
						shapeRendering="crispEdges"
						aria-label="Event QR Code"
					>
						<title>Event QR Code</title>
						<path d={qr.path} fill="#000000" />
					</svg>
				</div>
				<div
					style={{
						display: "flex",
						fontSize: "24px",
						fontWeight: 700,
						color: "#ffffff",
						marginTop: "28px",
						textAlign: "center",
					}}
				>
					{isJudging ? l.scanToFollowJudging : l.scanToViewAndRegister}
				</div>
				<div
					style={{
						display: "flex",
						fontSize: "18px",
						color: "#71717a",
						marginTop: "8px",
						textAlign: "center",
					}}
				>
					astrea.app
				</div>
			</div>
		</div>
	);
}

/**
 * Selects and renders the appropriate event card JSX element based on the model's template type.
 */
export function renderEventCard(
	model: EventCardModel,
	labels?: EventCardLabels,
): ReactElement {
	switch (model.templateType) {
		case "open":
			return <OpenEventCard model={model} labels={labels} />;
		case "winners":
			return <WinnersEventCard model={model} labels={labels} />;
		default:
			return <GenericCard labels={labels} />;
	}
}
