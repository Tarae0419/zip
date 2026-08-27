import { config } from "dotenv"
import { vi } from "vitest"

config({ path: ".env.local" })

// `unstable_cache` needs a live Next.js incremental-cache context. DB integration
// tests exercise the query functions directly, so keep the function behavior but
// remove only the framework cache wrapper in this dedicated test process.
vi.mock("next/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/cache")>()

  return {
    ...actual,
    unstable_cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
  }
})
