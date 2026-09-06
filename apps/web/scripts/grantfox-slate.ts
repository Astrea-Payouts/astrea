import { resolve } from "node:path";
import {
	formatGrantFoxIssuePayload,
	SEPTEMBER_15_CAMPAIGN_SLATE,
	validateCampaignSlate,
} from "../src/lib/grantfox/slate";

function main() {
	const repoRoot = resolve(process.cwd(), "../..");
	console.log("==================================================");
	console.log("Astrea GrantFox Campaign Slate — Verification & Publishing");
	console.log("==================================================");
	console.log(`Campaign: ${SEPTEMBER_15_CAMPAIGN_SLATE.campaignName}`);
	console.log(`Date: ${SEPTEMBER_15_CAMPAIGN_SLATE.campaignDate}`);
	console.log(`Repository Root: ${repoRoot}`);

	const result = validateCampaignSlate(SEPTEMBER_15_CAMPAIGN_SLATE, repoRoot);

	console.log("\n--- Validation Summary ---");
	console.log(`Valid: ${result.isValid ? "YES" : "NO"}`);
	console.log(`Total Issues: ${result.totalIssues} (Required: 6-8)`);
	console.log(
		`Total S-Equivalents: ${result.totalSEquivalents} (Budget: 10-14 S-eq)`,
	);
	console.log(`Functional Categories: ${result.categories.join(", ")}`);

	if (result.violations.length > 0) {
		console.error("\nViolations detected:");
		for (const v of result.violations) {
			console.error(`- [${v.rule}] ${v.message}`);
		}
		process.exit(1);
	}

	console.log("\n--- Verified Campaign Slate Items ---");
	for (const item of SEPTEMBER_15_CAMPAIGN_SLATE.items) {
		console.log(
			`#${item.number} [${item.code}] ${item.title} | Size: ${item.size} (${item.sEquivalents} S-eq) | Category: ${item.category}`,
		);
	}

	const mode = process.argv[2];
	if (mode === "publish" || mode === "format") {
		console.log("\n==================================================");
		console.log("GrantFox Issue Payloads Ready for Publication");
		console.log("==================================================\n");
		for (const item of SEPTEMBER_15_CAMPAIGN_SLATE.items) {
			console.log(formatGrantFoxIssuePayload(item));
			console.log("--------------------------------------------------\n");
		}
	}
}

main();
