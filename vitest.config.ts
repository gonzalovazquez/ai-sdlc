import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: [
      "src/__tests__/unit/**/*.test.ts",
      "src/__tests__/bdd/**/*.test.ts",
      "src/__tests__/integration/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
