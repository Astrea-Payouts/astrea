// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const ORGANIZER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const { mockAction } = vi.hoisted(() => ({ mockAction: vi.fn() }));
vi.mock("./actions", () => ({ createDraftEventAction: mockAction }));

// useActionState calls the action with (prevState, formData) on submit;
// jsdom's requestSubmit needs the form to be valid, so tests fill it.
const { EventForm } = await import("./event-form");

function render() {
	return renderWithIntl(
		<EventForm organizerAddress={ORGANIZER} symbol="USDC" />,
	);
}

describe("EventForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAction.mockResolvedValue(null);
	});

	afterEach(() => {
		cleanup();
	});

	it("starts with one prize row whose remove button is disabled", () => {
		render();

		expect(
			screen.getAllByRole("textbox", { name: /Prize #\d+ amount/ }),
		).toHaveLength(1);
		expect(
			screen.getByRole("button", { name: "Remove prize #1" }),
		).toBeDisabled();
		expect(
			screen.getByText(new RegExp(ORGANIZER.slice(0, 8))),
		).toBeInTheDocument();
	});

	it("adds and removes prize rows, renumbering by position", () => {
		render();

		fireEvent.click(
			screen.getByRole("button", { name: messages.OrganizerNew.addPrize }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: messages.OrganizerNew.addPrize }),
		);
		const rows = screen.getAllByRole("textbox", { name: /Prize #\d+ amount/ });
		expect(rows).toHaveLength(3);
		fireEvent.change(rows[0], { target: { value: "1.5" } });
		fireEvent.change(rows[1], { target: { value: "1" } });
		fireEvent.change(rows[2], { target: { value: "0.5" } });

		fireEvent.click(screen.getByRole("button", { name: "Remove prize #2" }));

		const after = screen.getAllByRole("textbox", { name: /Prize #\d+ amount/ });
		expect(after).toHaveLength(2);
		expect(after[0]).toHaveValue("1.5");
		// The former #3 is now #2: rank is the position, not a stored id.
		expect(after[1]).toHaveValue("0.5");
		expect(after[1]).toHaveAccessibleName("Prize #2 amount");
	});

	it("posts the datetime-local value as an ISO instant plus the browser zone", () => {
		const { container } = render();

		const local = container.querySelector(
			'input[type="datetime-local"]',
		) as HTMLInputElement;
		fireEvent.change(local, { target: { value: "2030-01-02T03:04" } });

		const hidden = container.querySelector(
			'input[name="judgingDeadlineAt"]',
		) as HTMLInputElement;
		expect(hidden.value).toBe(new Date("2030-01-02T03:04").toISOString());
		expect(hidden.value.endsWith("Z")).toBe(true);
		const tz = container.querySelector(
			'input[name="timezone"]',
		) as HTMLInputElement;
		expect(tz.value).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
	});

	it("leaves the ISO field empty until a deadline is picked", () => {
		const { container } = render();

		const hidden = container.querySelector(
			'input[name="judgingDeadlineAt"]',
		) as HTMLInputElement;
		expect(hidden.value).toBe("");
	});

	it("renders the refusal from the action with its detail", async () => {
		mockAction.mockResolvedValue({
			ok: false,
			code: "invalidPrize",
			detail: "#2",
		});
		const { container } = render();

		fireEvent.change(screen.getByRole("textbox", { name: /Event name/ }), {
			target: { value: "Slice" },
		});
		fireEvent.change(screen.getByRole("textbox", { name: "Prize #1 amount" }), {
			target: { value: "1" },
		});
		fireEvent.change(
			screen.getByRole("textbox", { name: /Judge wallet address/ }),
			{ target: { value: ORGANIZER } },
		);
		fireEvent.change(
			screen.getByRole("textbox", { name: /Judge display name/ }),
			{ target: { value: "Judge" } },
		);
		fireEvent.change(
			container.querySelector('input[type="datetime-local"]') as Element,
			{ target: { value: "2030-01-02T03:04" } },
		);
		fireEvent.submit(container.querySelector("form") as HTMLFormElement);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(messages.OrganizerNew.errors.invalidPrize);
		expect(alert).toHaveTextContent("#2");
		expect(mockAction).toHaveBeenCalledTimes(1);
		const fd = mockAction.mock.calls[0][1] as FormData;
		expect(fd.getAll("prize")).toEqual(["1"]);
		expect(fd.get("name")).toBe("Slice");
		expect(fd.get("judgeAddress")).toBe(ORGANIZER);
	});
});
