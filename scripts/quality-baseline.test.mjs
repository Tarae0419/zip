import { describe, expect, it } from "vitest"

import {
  assertFreshBuild,
  collectInitialChunkPaths,
  parseArgs,
  parseClientReferenceManifest,
  summarizeAssetSizes,
} from "./quality-baseline.mjs"

describe("quality baseline", () => {
  it("parses a Next client-reference manifest without evaluating JavaScript", () => {
    const source = `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};
globalThis.__RSC_MANIFEST["/cart/page"] = {"entryJSFiles":{"layout":["static/a.js"],"page":["static/b.js"]}};`

    expect(parseClientReferenceManifest(source)).toEqual({
      routeKey: "/cart/page",
      manifest: { entryJSFiles: { layout: ["static/a.js"], page: ["static/b.js"] } },
    })
  })

  it("deduplicates shared and route-specific initial chunks", () => {
    expect(
      collectInitialChunkPaths(
        { polyfillFiles: ["static/polyfill.js"], rootMainFiles: ["static/shared.js"] },
        {
          entryJSFiles: {
            layout: ["static/shared.js", "static/layout.js"],
            page: ["static/page.js", "static/layout.js"],
          },
        },
      ),
    ).toEqual([
      "static/layout.js",
      "static/page.js",
      "static/polyfill.js",
      "static/shared.js",
    ])
  })

  it("rejects a build older than measured source", () => {
    expect(() =>
      assertFreshBuild(1_000, [
        { file: "app/page.tsx", mtimeMs: 900 },
        { file: "components/example.tsx", mtimeMs: 2_100 },
      ]),
    ).toThrow(/production build is stale.*components\/example\.tsx/i)
  })

  it("accepts timestamp differences within filesystem precision", () => {
    expect(() =>
      assertFreshBuild(1_000, [{ file: "app/page.tsx", mtimeMs: 1_999 }]),
    ).not.toThrow()
  })

  it("keeps raw and gzip byte totals separate", () => {
    expect(
      summarizeAssetSizes([
        { rawBytes: 1_000, gzipBytes: 300 },
        { rawBytes: 500, gzipBytes: 120 },
      ]),
    ).toEqual({ rawBytes: 1_500, gzipBytes: 420 })
  })

  it("accepts pnpm's argument separator before --out", () => {
    expect(parseArgs(["--", "--out", "docs/baseline.json"])).toEqual({
      out: "docs/baseline.json",
    })
  })
})
