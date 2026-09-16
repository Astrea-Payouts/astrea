import { type RenderOptions, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import messages from "../../messages/en.json";

// Components under test call useTranslations; the real EN catalogue is used
// so assertions read the same copy the page ships.
export function renderWithIntl(
	ui: ReactElement,
	options?: Omit<RenderOptions, "wrapper">,
) {
	return render(ui, {
		...options,
		wrapper: ({ children }) => (
			<NextIntlClientProvider locale="en" messages={messages}>
				{children}
			</NextIntlClientProvider>
		),
	});
}

export { messages };
