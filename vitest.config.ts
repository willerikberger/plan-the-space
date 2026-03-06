import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    exclude: ["node_modules/**", "e2e/**"],
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "src/components/ui/**",
        "**/*.config.*",
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
