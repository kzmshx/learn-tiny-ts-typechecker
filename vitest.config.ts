import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		includeSource: ["src/**/*.ts"],
		coverage: {
			reporter: ["text", "json-summary", "json"],
		},
	},
	define: {
		"import.meta.vitest": "undefined",
	},
});
