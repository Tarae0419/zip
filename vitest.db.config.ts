import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    name: "db-integration",
    environment: "node",
    include: ["**/*.integration.test.?(c|m)[jt]s?(x)"],
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
