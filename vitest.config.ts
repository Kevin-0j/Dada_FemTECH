import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    execArgv: ["--disable-warning=ExperimentalWarning"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
