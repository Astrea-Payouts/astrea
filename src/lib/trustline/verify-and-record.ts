import { db } from "@/lib/db";
import { hasUsdcTrustline } from "./verify-trustline";

// Used at both ADR-004 checkpoints: participant registration and, again,
// winner assignment — a trustline can be closed between the two.
export async function verifyAndRecordTrustline(
	walletId: string,
	address: string,
): Promise<boolean> {
	const verified = await hasUsdcTrustline(address);
	if (verified) {
		await db.wallet.update({
			where: { id: walletId },
			data: { usdcTrustlineVerifiedAt: new Date() },
		});
	}
	return verified;
}
