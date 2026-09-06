import { ImageResponse } from "next/og";
import { getPublicEventById } from "@/lib/event-public-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

export default async function Image({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { id } = await params;
	const event = await getPublicEventById(id);

	const eventName = event?.name || "Verified Prize Escrow Event";
	const totalPrize = event
		? `$${event.totalPrizeUsdc.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USDC`
		: "Guaranteed Prize Pool";
	const isVerified = Boolean(event?.escrowContractId);
	const status = event?.status || "LIVE";

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				backgroundColor: "#05060d",
				backgroundImage:
					"radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.15), transparent 45%), radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.12), transparent 45%)",
				padding: "60px 70px",
				fontFamily: "system-ui, sans-serif",
				color: "#ffffff",
			}}
		>
			{/* Top Header */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					width: "100%",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
					<div
						style={{
							width: "42px",
							height: "42px",
							borderRadius: "10px",
							backgroundColor: "#10b981",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#000000",
							fontWeight: "bold",
							fontSize: "24px",
						}}
					>
						A
					</div>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
						}}
					>
						<span
							style={{
								fontSize: "26px",
								fontWeight: "800",
								letterSpacing: "0.08em",
								color: "#ffffff",
							}}
						>
							ASTREA
						</span>
						<span
							style={{
								fontSize: "12px",
								letterSpacing: "0.15em",
								textTransform: "uppercase",
								color: "rgba(255, 255, 255, 0.55)",
								marginTop: "2px",
							}}
						>
							Stellar Smart Escrows
						</span>
					</div>
				</div>

				{/* On-Chain Verified Badge */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 20px",
						borderRadius: "9999px",
						backgroundColor: isVerified
							? "rgba(16, 185, 129, 0.15)"
							: "rgba(255, 255, 255, 0.08)",
						border: isVerified
							? "1px solid rgba(16, 185, 129, 0.35)"
							: "1px solid rgba(255, 255, 255, 0.15)",
						color: isVerified ? "#34d399" : "rgba(255, 255, 255, 0.7)",
						fontSize: "14px",
						fontWeight: "600",
						letterSpacing: "0.05em",
					}}
				>
					{isVerified ? "🛡️ Prizes Verified On-Chain" : `Status: ${status}`}
				</div>
			</div>

			{/* Center: Event Title */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "18px",
					maxWidth: "950px",
					marginTop: "20px",
					marginBottom: "20px",
				}}
			>
				<span
					style={{
						fontSize: "14px",
						fontWeight: "700",
						letterSpacing: "0.18em",
						textTransform: "uppercase",
						color: "#34d399",
					}}
				>
					Hackathon & Bounty Track
				</span>
				<div
					style={{
						fontSize: "56px",
						fontWeight: "800",
						lineHeight: "1.12",
						color: "#ffffff",
						textOverflow: "ellipsis",
						overflow: "hidden",
					}}
				>
					{eventName}
				</div>
			</div>

			{/* Bottom Bar: Prize Pool & Trustless Work Proof */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-end",
					width: "100%",
					borderTop: "1px solid rgba(255, 255, 255, 0.12)",
					paddingTop: "32px",
				}}
			>
				<div style={{ display: "flex", flexDirection: "column" }}>
					<span
						style={{
							fontSize: "13px",
							textTransform: "uppercase",
							letterSpacing: "0.14em",
							color: "rgba(255, 255, 255, 0.5)",
						}}
					>
						Total Committed Prize Pool
					</span>
					<span
						style={{
							fontSize: "44px",
							fontWeight: "800",
							fontFamily: "monospace",
							color: "#10b981",
							marginTop: "4px",
						}}
					>
						{totalPrize}
					</span>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "flex-end",
						gap: "6px",
					}}
				>
					<span
						style={{
							fontSize: "14px",
							color: "rgba(255, 255, 255, 0.75)",
							fontWeight: "500",
						}}
					>
						Soroban Smart Escrow
					</span>
					<span
						style={{
							fontSize: "12px",
							color: "rgba(255, 255, 255, 0.4)",
							fontFamily: "monospace",
						}}
					>
						astrea.app/events/{id}
					</span>
				</div>
			</div>
		</div>,
		{
			...size,
		},
	);
}
