import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CSSProperties, ReactElement } from "react";
import { truncateHash } from "../explorer";
import { qrSvgPath } from "../qr";
import type { CardWinner, EventCardModel } from "./card-model";

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

export function GenericCard(): ReactElement {
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
				Escrow-Backed Prize Payouts
			</div>
			<div
				style={{
					display: "flex",
					fontSize: "24px",
					color: "#a1a1aa",
					marginBottom: "32px",
				}}
			>
				Smart-contract prize pools on Stellar. Auditable, automated,
				non-custodial.
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
				Built on Stellar Soroban
			</div>
		</div>
	);
}

export function OpenEventCard({
	model,
}: {
	model: EventCardModel;
}): ReactElement {
	const isJudging = model.status === "JUDGING";

	let statusLabel = "REGISTRATIONS OPEN";
	let statusBg = "#064e3b";
	let statusColor = "#34d399";

	if (isJudging) {
		statusLabel = "JUDGING IN PROGRESS";
		statusBg = "#3b0764";
		statusColor = "#c084fc";
	} else if (model.isRegistrationClosed) {
		statusLabel = "REGISTRATIONS CLOSED";
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
							LOCKED ON-CHAIN PRIZE POOL
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
							Escrow Assurance
						</span>
						<span
							style={{
								fontSize: "16px",
								fontWeight: 600,
								color: "#e4e4e7",
							}}
						>
							Verifiable on Stellar Soroban
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
									Deadline
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
					<span>Organizer: {model.organizer}</span>
					{model.judges.length > 0 ? (
						<span>
							Judge{model.judges.length > 1 ? "s" : ""}:{" "}
							{model.judges.slice(0, 2).join(", ")}
							{model.judges.length > 2 ? ` +${model.judges.length - 2}` : ""}
						</span>
					) : null}
				</div>
				<div style={{ display: "flex", gap: "16px" }}>
					<span>{model.teamsRegistered} teams registered</span>
				</div>
			</div>
		</div>
	);
}

function WinnerCard({
	winner,
	isHero = false,
}: {
	winner: CardWinner;
	isHero?: boolean;
}): ReactElement {
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
				flex: 1,
				backgroundColor: "#0d0d11",
				border: `1px solid ${isHero ? "#10b98160" : rankMeta.border}`,
				borderRadius: "16px",
				padding: isHero ? "28px 32px" : "18px 20px",
				justifyContent: "space-between",
				boxSizing: "border-box",
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
							fontSize: isHero ? "15px" : "13px",
							fontWeight: 800,
						}}
					>
						#{winner.rank} PLACE
					</span>
					<span
						style={{
							fontSize: isHero ? "26px" : "20px",
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
						fontSize: isHero ? "30px" : "20px",
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
							fontSize: isHero ? "16px" : "13px",
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
						fontSize: "12px",
						color: "#71717a",
						marginTop: "12px",
						borderTop: "1px solid #1f1f23",
						paddingTop: "8px",
					}}
				>
					<span style={{ color: "#10b981" }}>✓ Payout:</span>
					<span style={{ fontFamily: "monospace" }}>
						{truncateHash(winner.txHash, 6, 6)}
					</span>
				</div>
			) : null}
		</div>
	);
}

export function WinnersEventCard({
	model,
}: {
	model: EventCardModel;
}): ReactElement {
	const winnersCount = model.winners.length;
	const isHero = winnersCount === 1;
	const topThree = model.winners.slice(0, 3);
	const remainingCount = Math.max(0, winnersCount - 3);

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
						backgroundColor: "#064e3b",
						color: "#34d399",
						fontSize: "14px",
						fontWeight: 700,
						letterSpacing: "0.05em",
					}}
				>
					COMPLETED • VERIFIED PAYOUTS
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
					<span style={{ fontSize: "14px", color: "#a1a1aa" }}>Total:</span>
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
					<WinnerCard winner={model.winners[0]} isHero={true} />
				</div>
			) : (
				<div
					style={{
						display: "flex",
						gap: "16px",
						width: "100%",
						boxSizing: "border-box",
					}}
				>
					{topThree.map((winner) => (
						<WinnerCard key={winner.rank} winner={winner} />
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
				<span>Organizer: {model.organizer}</span>
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
						+{remainingCount} more winner{remainingCount > 1 ? "s" : ""} paid
						on-chain
					</div>
				) : (
					<span style={{ color: "#34d399" }}>
						All payouts verified on Stellar
					</span>
				)}
			</div>
		</div>
	);
}

export function DisplayEventCard({
	model,
	canonicalUrl,
}: {
	model: EventCardModel;
	canonicalUrl: string;
}): ReactElement {
	const qr = qrSvgPath(canonicalUrl);

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
								backgroundColor:
									model.status === "JUDGING" ? "#3b0764" : "#064e3b",
								color: model.status === "JUDGING" ? "#c084fc" : "#34d399",
								fontSize: "18px",
								fontWeight: 700,
								letterSpacing: "0.05em",
								marginLeft: "20px",
							}}
						>
							{model.status === "JUDGING"
								? "JUDGING IN PROGRESS"
								: "LIVE COMPETITION"}
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
						LOCKED ON-CHAIN PRIZE POOL
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
							Secured by Stellar Soroban Smart Contract Escrow
						</span>
						{model.formattedDeadline ? (
							<span
								style={{
									fontSize: "20px",
									fontWeight: 700,
									color: "#e4e4e7",
								}}
							>
								Judging Deadline: {model.formattedDeadline}
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
					<span>{model.teamsRegistered} Teams Registered</span>
					<span>Organizer: {model.organizer}</span>
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
					Scan to view & register
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

export function renderEventCard(model: EventCardModel): ReactElement {
	switch (model.templateType) {
		case "open":
			return <OpenEventCard model={model} />;
		case "winners":
			return <WinnersEventCard model={model} />;
		default:
			return <GenericCard />;
	}
}
