import { ArrowLeft } from "lucide-react";
import { EventDashboard } from "@/components/organizer/event-dashboard";
import { Link } from "@/i18n/navigation";
import type { OrganizerEvent } from "@/lib/organizer/types";

interface PageProps {
	params: Promise<{
		locale: string;
		id: string;
	}>;
}

export default async function OrganizerEventPage({ params }: PageProps) {
	const { id } = await params;

	// In production, this fetches from the Go core service (E03 API).
	// Provides realistic, fully populated seed state for demonstration & testing.
	const initialEvent: OrganizerEvent = {
		id,
		title: "Stellar Meridian Hackathon 2026",
		description:
			"Build next-generation decentralized finance and cross-border payment solutions on the Stellar Soroban network.",
		organizerAddress:
			"GBWM3EQRHY6MVR3QFXG4X2Q2C76I43QZTYW3X6L4J7K3Z4F6W2Y6X6L4",
		status: "FUNDED",
		conditionsMetAt: "2026-09-06T10:00:00.000Z",
		publishedAt: null,
		funding: {
			targetAmount: 5000,
			currentBalance: 5000,
			currency: "USDC",
			contractId: "CBWM3EQRHY6MVR3QFXG4X2Q2C76I43QZTYW3X6L4J7K3Z4F6W2Y6X6L4",
			isFunded: true,
			depositAddress:
				"GBWM3EQRHY6MVR3QFXG4X2Q2C76I43QZTYW3X6L4J7K3Z4F6W2Y6X6L4",
			requiredMinParticipants: 3,
			registeredParticipantsCount: 4,
		},
		emergencyWithdraw: {
			status: "NONE",
			organizerSigned: false,
			resolverCoSigned: false,
		},
		participants: [
			{
				id: "p-1",
				name: "Alex Rivera",
				walletAddress:
					"GDGHECOW7X4W45G6D5L6YF7L6X6K3L4P5O6I7U8Y9T0R1E2W3Q4A5S6D",
				registeredAt: "2026-09-06T08:30:00Z",
				hasTrustline: true,
				answers: { Track: "DeFi / Soroban", "Team Size": "3" },
			},
			{
				id: "p-2",
				name: "Sarah Chen",
				walletAddress:
					"GB5XF7K2L9M4N3O2P1Q8R7S6T5U4V3W2X1Y0Z9A8B7C6D5E4F3G2H1J0",
				registeredAt: "2026-09-06T09:15:00Z",
				hasTrustline: true,
				answers: { Track: "Cross-Border Payments" },
			},
			{
				id: "p-3",
				name: "Marcus Vance",
				walletAddress:
					"GC7R4T1Y8U2I9O3P5A6S4D2F1G8H9J3K5L7Z2X4C6V8B0N1M3Q5W7E9R",
				registeredAt: "2026-09-06T09:45:00Z",
				hasTrustline: false,
				answers: { Track: "Public Goods" },
			},
			{
				id: "p-4",
				name: "Elena Rostova",
				walletAddress:
					"GA4K2L8P9O1I3U5Y7T9R2E4W6Q8A0S2D4F6G8H0J2K4L6Z8X0C2V4B6N",
				registeredAt: "2026-09-06T10:10:00Z",
				hasTrustline: true,
				answers: { Track: "DeFi / Soroban" },
			},
		],
		createdAt: "2026-09-05T14:00:00Z",
		updatedAt: "2026-09-06T10:00:00Z",
	};

	return (
		<main className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-6xl">
				<div className="mb-6">
					<Link
						href="/organizer"
						className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
					>
						<ArrowLeft className="size-4" />
						<span>Back to Organizer Overview</span>
					</Link>
				</div>

				<EventDashboard initialEvent={initialEvent} />
			</div>
		</main>
	);
}
