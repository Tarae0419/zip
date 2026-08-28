import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { pathToFileURL } from "node:url"
import { gzip } from "node:zlib"

const gzipAsync = promisify(gzip)
const projectRoot = process.cwd()
const nextRoot = path.join(projectRoot, ".next")

async function exists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function walk(relativeDir, predicate = () => true) {
  const absoluteDir = path.join(projectRoot, relativeDir)
  if (!(await exists(absoluteDir))) return []

  const results = []
  const entries = await readdir(absoluteDir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name)
    const relativePath = path.relative(projectRoot, absolutePath).replaceAll(path.sep, "/")

    if (entry.isDirectory()) {
      results.push(...(await walk(relativePath, predicate)))
    } else if (predicate(relativePath)) {
      results.push(relativePath)
    }
  }

  return results
}

async function countMatchingFiles(files, pattern) {
  let count = 0
  for (const file of files) {
    const content = await readFile(path.join(projectRoot, file), "utf8")
    if (pattern.test(content)) count += 1
  }
  return count
}

export function parseClientReferenceManifest(source) {
  const assignmentIndex = source.lastIndexOf(" = ")
  if (assignmentIndex < 0) throw new Error("Client reference manifest assignment was not found.")

  const prefix = source.slice(0, assignmentIndex)
  const routeMatch = prefix.match(/__RSC_MANIFEST\["([^"]+)"\]\s*$/)
  if (!routeMatch) throw new Error("Client reference manifest route was not found.")

  const json = source.slice(assignmentIndex + 3).trim().replace(/;$/, "")
  return { routeKey: routeMatch[1], manifest: JSON.parse(json) }
}

export function collectInitialChunkPaths(buildManifest, routeManifest) {
  const chunks = new Set([
    ...(buildManifest.polyfillFiles ?? []),
    ...(buildManifest.rootMainFiles ?? []),
    ...Object.values(routeManifest.entryJSFiles ?? {}).flat(),
  ])
  return [...chunks].sort()
}

export function assertFreshBuild(buildMtimeMs, sourceEntries) {
  const latestSource = sourceEntries.reduce(
    (latest, entry) => (entry.mtimeMs > latest.mtimeMs ? entry : latest),
    { file: null, mtimeMs: 0 },
  )

  if (latestSource.mtimeMs > buildMtimeMs + 1_000) {
    throw new Error(
      `The production build is stale (newer source: ${latestSource.file}). Run \`pnpm build\` before measuring.`,
    )
  }
}

export function summarizeAssetSizes(assets) {
  return {
    rawBytes: assets.reduce((sum, asset) => sum + asset.rawBytes, 0),
    gzipBytes: assets.reduce((sum, asset) => sum + asset.gzipBytes, 0),
  }
}

function normalizeNextAssetPath(assetPath) {
  return assetPath.replace(/^\/?_next\//, "").replace(/^\//, "")
}

async function getAssetSize(assetPath, cache) {
  const normalized = normalizeNextAssetPath(assetPath)
  const cached = cache.get(normalized)
  if (cached) return cached

  const content = await readFile(path.join(nextRoot, normalized))
  const value = {
    file: `.next/${normalized}`,
    rawBytes: content.byteLength,
    gzipBytes: (await gzipAsync(content)).byteLength,
  }
  cache.set(normalized, value)
  return value
}

async function assertCurrentProductionBuild(sourceFiles) {
  const buildIdPath = path.join(nextRoot, "BUILD_ID")
  if (!(await exists(buildIdPath))) {
    throw new Error("A production build was not found. Run `pnpm build` before measuring.")
  }

  const buildStat = await stat(buildIdPath)
  const freshnessInputs = [...sourceFiles, "next.config.mjs", "package.json", "pnpm-lock.yaml"]
  const sourceEntries = await Promise.all(
    freshnessInputs.map(async (file) => ({ file, mtimeMs: (await stat(path.join(projectRoot, file))).mtimeMs })),
  )
  assertFreshBuild(buildStat.mtimeMs, sourceEntries)
}

async function buildChunkStats(assetCache) {
  const chunkFiles = await walk(".next/static/chunks", (file) => file.endsWith(".js"))
  const sizes = await Promise.all(
    chunkFiles.map((file) => getAssetSize(file.replace(/^\.next\//, ""), assetCache)),
  )
  sizes.sort((a, b) => b.rawBytes - a.rawBytes)
  const totals = summarizeAssetSizes(sizes)

  return {
    emittedChunkCount: sizes.length,
    emittedRawJsBytes: totals.rawBytes,
    emittedGzipJsBytes: totals.gzipBytes,
    largestEmittedChunks: sizes.slice(0, 5),
    note: "All emitted JavaScript chunks; this is not what one page necessarily transfers.",
  }
}

async function buildRouteStats(assetCache) {
  const buildManifest = JSON.parse(await readFile(path.join(nextRoot, "build-manifest.json"), "utf8"))
  const appRoutes = JSON.parse(
    await readFile(path.join(nextRoot, "app-path-routes-manifest.json"), "utf8"),
  )
  const manifestFiles = await walk(
    ".next/server/app",
    (file) => file.endsWith("page_client-reference-manifest.js"),
  )

  const routeStats = []
  for (const file of manifestFiles) {
    const { routeKey, manifest } = parseClientReferenceManifest(
      await readFile(path.join(projectRoot, file), "utf8"),
    )
    const route = appRoutes[routeKey]
    if (!route || route.startsWith("/_")) continue

    const chunkPaths = collectInitialChunkPaths(buildManifest, manifest)
    const chunks = await Promise.all(chunkPaths.map((chunk) => getAssetSize(chunk, assetCache)))
    const totals = summarizeAssetSizes(chunks)
    routeStats.push({
      route,
      initialChunkCount: chunks.length,
      initialRawJsBytes: totals.rawBytes,
      initialGzipJsBytes: totals.gzipBytes,
    })
  }

  return routeStats.sort((a, b) => a.route.localeCompare(b.route))
}

function unavailable(reason) {
  return { status: "unavailable", reason }
}

export function parseArgs(argv) {
  let out = null
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--") continue
    if (argv[index] === "--out") {
      out = argv[index + 1]
      if (!out) throw new Error("--out requires a workspace-relative path.")
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argv[index]}`)
  }
  return { out }
}

function resolveOutputPath(relativePath) {
  const resolved = path.resolve(projectRoot, relativePath)
  const relative = path.relative(projectRoot, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("--out must stay inside the project workspace.")
  }
  return resolved
}

export async function createBaseline() {
  const appFiles = await walk("app", (file) => /\.(ts|tsx)$/.test(file))
  const componentFiles = await walk("components", (file) => /\.(ts|tsx)$/.test(file))
  const libFiles = await walk("lib", (file) => /\.(ts|tsx)$/.test(file))
  const scriptFiles = await walk("scripts", (file) => /\.(mjs|ts)$/.test(file))
  const sourceFiles = [...appFiles, ...componentFiles, ...libFiles]
  await assertCurrentProductionBuild(sourceFiles)

  const schema = await readFile(path.join(projectRoot, "lib/db/schema.ts"), "utf8")
  const layout = await readFile(path.join(projectRoot, "app/layout.tsx"), "utf8")
  const assetCache = new Map()
  const [emitted, routes] = await Promise.all([
    buildChunkStats(assetCache),
    buildRouteStats(assetCache),
  ])

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    buildId: (await readFile(path.join(nextRoot, "BUILD_ID"), "utf8")).trim(),
    source: {
      routes: appFiles.filter((file) => file.endsWith("/page.tsx") || file === "app/page.tsx").length,
      clientComponents: await countMatchingFiles(
        [...appFiles, ...componentFiles],
        /^\s*["']use client["']/m,
      ),
      serverActionFiles: await countMatchingFiles(libFiles, /^\s*["']use server["']/m),
      localStorageFiles: await countMatchingFiles(sourceFiles, /\blocalStorage\b/),
      testFiles: [...sourceFiles, ...scriptFiles].filter((file) => /\.(test|spec)\.(mjs|ts|tsx)$/.test(file)).length,
      databaseTables: [...schema.matchAll(/export const \w+ = pgTable\(/g)].length,
    },
    clientJavaScript: { ...emitted, routes },
    instrumentation: {
      productionAnalyticsComponent: /<Analytics\s*\/?\s*>/.test(layout),
      pageResponseP95: unavailable("No representative route benchmark or production Web Vital export is connected yet."),
      databaseQueries: unavailable("No per-request Neon/Drizzle query counter is connected yet."),
      aiCallsAndFailures: unavailable("No sanitized OpenAI call counter and failure metric is connected yet."),
      mapRequests: unavailable("TMAP route calls are rate-limited but daily usage telemetry is not connected yet."),
    },
  }
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2))
  const serialized = `${JSON.stringify(await createBaseline(), null, 2)}\n`

  if (out) {
    const outputPath = resolveOutputPath(out)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, serialized, "utf8")
  }
  process.stdout.write(serialized)
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
