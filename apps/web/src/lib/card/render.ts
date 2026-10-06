export type CardTheme = "dark" | "light";

export interface CardModel {
	login: string;
	isPublic: boolean;
	eventsParticipated: number;
	prizesWon: number;
	totalPaidAmount: string;
	totalPaidAsset: string;
	lastEvents: string[]; // up to 3 event names
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

const FONT_SANS =
	"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const FOOTER_MAX_CHARS = 50;

function truncate(str: string, max: number): string {
	if (str.length <= max) return str;
	return `${str.slice(0, max - 1)}…`;
}

export function renderSvgCard(
	model: CardModel,
	theme: CardTheme = "dark",
): string {
	const isDark = theme === "dark";
	const bg = isDark ? "#09090b" : "#ffffff";
	const border = isDark ? "#27272a" : "#e4e4e7";
	const textPrimary = isDark ? "#ffffff" : "#09090b";
	const textMuted = isDark ? "#a1a1aa" : "#71717a";
	const accentBg = isDark
		? "rgba(59, 130, 246, 0.1)"
		: "rgba(59, 130, 246, 0.08)";
	const accentText = isDark ? "#60a5fa" : "#2563eb";
	const cardBorder = isDark
		? "rgba(255, 255, 255, 0.1)"
		: "rgba(0, 0, 0, 0.08)";

	if (!model.isPublic) {
		return `<svg width="480" height="160" viewBox="0 0 480 160" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .font-sans { font-family: ${FONT_SANS}; }
  </style>
  <rect width="480" height="160" rx="16" fill="${bg}" stroke="${border}" stroke-width="1"/>
  <g transform="translate(32, 32)">
    <text x="0" y="24" class="font-sans" font-size="20" font-weight="700" fill="${textPrimary}">@${escapeXml(model.login)}</text>
    <text x="0" y="56" class="font-sans" font-size="14" fill="${textMuted}">Profile not public</text>
    <rect x="0" y="80" width="120" height="24" rx="12" fill="${accentBg}"/>
    <text x="12" y="96" class="font-sans" font-size="11" font-weight="600" fill="${accentText}">ASTREA</text>
  </g>
</svg>`;
	}

	const eventsText = `${model.eventsParticipated} event${model.eventsParticipated === 1 ? "" : "s"}`;
	const prizesText = `${model.prizesWon} win${model.prizesWon === 1 ? "" : "s"}`;
	const totalPaidText = `${model.totalPaidAmount} ${model.totalPaidAsset}`;

	const recentEventsText =
		model.lastEvents.length > 0
			? truncate(model.lastEvents.slice(0, 3).join(" • "), FOOTER_MAX_CHARS)
			: "None";

	return `<svg width="480" height="160" viewBox="0 0 480 160" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .font-sans { font-family: ${FONT_SANS}; }
    .label { font-family: ${FONT_SANS}; font-size: 11px; fill: ${textMuted}; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { font-family: ${FONT_SANS}; font-size: 16px; font-weight: 700; fill: ${textPrimary}; }
  </style>
  <rect width="480" height="160" rx="16" fill="${bg}" stroke="${cardBorder}" stroke-width="1"/>

  <!-- Header / Login -->
  <g transform="translate(24, 24)">
    <text x="0" y="16" class="font-sans" font-size="18" font-weight="700" fill="${textPrimary}">@${escapeXml(model.login)}</text>
    <rect x="340" y="0" width="92" height="22" rx="11" fill="${accentBg}"/>
    <text x="352" y="15" class="font-sans" font-size="10" font-weight="700" fill="${accentText}" letter-spacing="0.08em">ASTREA</text>
  </g>

  <!-- Stats Grid -->
  <g transform="translate(24, 64)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="label">Events</text>
      <text x="0" y="20" class="value">${escapeXml(eventsText)}</text>
    </g>
    <g transform="translate(120, 0)">
      <text x="0" y="0" class="label">Prizes</text>
      <text x="0" y="20" class="value">${escapeXml(prizesText)}</text>
    </g>
    <g transform="translate(240, 0)">
      <text x="0" y="0" class="label">Total Paid</text>
      <text x="0" y="20" class="value">${escapeXml(totalPaidText)}</text>
    </g>
  </g>

  <!-- Recent Events / Footer divider -->
  <line x1="24" y1="110" x2="456" y2="110" stroke="${cardBorder}" stroke-width="1"/>

  <g transform="translate(24, 130)">
    <text x="0" y="0" class="font-sans" font-size="11" fill="${textMuted}">Recent: ${escapeXml(recentEventsText)}</text>
  </g>
</svg>`;
}
