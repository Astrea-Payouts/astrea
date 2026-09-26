// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { qrSvgPath } from "@/lib/qr";
import { EventQrCode } from "./event-qr-code";

const URL_EN =
	"https://astrea-payouts.vercel.app/en/events/20000000-0000-0000-0000-000000000001";
const URL_OTHER =
	"https://astrea-payouts.vercel.app/en/events/20000000-0000-0000-0000-000000000002";

const labels = {
	title: "Share this event",
	hint: "Scan to open this page.",
	alt: "QR code linking to this event page",
};

describe("EventQrCode (U11 / #28)", () => {
	afterEach(() => {
		cleanup();
	});

	it("encodes exactly the URL it is given", () => {
		render(<EventQrCode url={URL_EN} labels={labels} />);

		const svg = screen.getByTestId("event-qr-code");
		const drawn = svg.querySelector("path")?.getAttribute("d");
		expect(drawn).toBe(qrSvgPath(URL_EN).path);
	});

	it("draws a different code for a different event", () => {
		render(<EventQrCode url={URL_EN} labels={labels} />);
		const drawn = screen
			.getByTestId("event-qr-code")
			.querySelector("path")
			?.getAttribute("d");

		expect(drawn).not.toBe(qrSvgPath(URL_OTHER).path);
	});

	it("reserves a 4-module quiet zone on a white background", () => {
		render(<EventQrCode url={URL_EN} labels={labels} />);
		const { size } = qrSvgPath(URL_EN);
		const svg = screen.getByTestId("event-qr-code");

		expect(svg).toHaveAttribute("viewBox", `-4 -4 ${size + 8} ${size + 8}`);
		expect(svg.querySelector("rect")).toHaveAttribute("fill", "#ffffff");
		expect(svg.querySelector("path")).toHaveAttribute("fill", "#000000");
	});

	it("is labelled for assistive tech and shows the URL as a link", () => {
		render(<EventQrCode url={URL_EN} labels={labels} />);

		expect(screen.getByRole("img", { name: labels.alt })).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: labels.title }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: URL_EN })).toHaveAttribute(
			"href",
			URL_EN,
		);
	});
});
