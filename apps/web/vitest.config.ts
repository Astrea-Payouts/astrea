import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			// Next.js resolves the `server-only` marker itself at bundle time
			// (it isn't an installed package); tests import its no-op build.
			"server-only": path.resolve(
				__dirname,
				"./node_modules/next/dist/compiled/server-only/empty.js",
			),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		setupFiles: ["./vitest.setup.ts"],
		testTimeout: 15000,
		coverage: {
			provider: "v8",
			reporter: ["lcov", "text"],
			reportsDirectory: "./coverage",
		},
	},
});
