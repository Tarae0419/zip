import path from "node:path"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "**/*.integration.test.?(c|m)[jt]s?(x)"],
  },
})
