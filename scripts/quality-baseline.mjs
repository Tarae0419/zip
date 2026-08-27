import { access, readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"

const projectRoot = process.cwd()

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

async function buildChunkStats() {
  const chunkFiles = await walk(".next/static/chunks", (file) => file.endsWith(".js"))
  const sizes = []

  for (const file of chunkFiles) {
    const fileStat = await stat(path.join(projectRoot, file))
    sizes.push({ file, bytes: fileStat.size })
  }

  sizes.sort((a, b) => b.bytes - a.bytes)

  return {
    available: sizes.length > 0,
    generatedBuildId: (await exists(path.join(projectRoot, ".next/BUILD_ID")))
      ? (await readFile(path.join(projectRoot, ".next/BUILD_ID"), "utf8")).trim()
      : null,
    chunkCount: sizes.length,
    rawBytes: sizes.reduce((sum, chunk) => sum + chunk.bytes, 0),
    largestChunks: sizes.slice(0, 5),
    note: "Raw emitted JavaScript bytes across the build, not compressed per-route transfer size.",
  }
}

const appFiles = await walk("app", (file) => /\.(ts|tsx)$/.test(file))
const componentFiles = await walk("components", (file) => /\.(ts|tsx)$/.test(file))
const libFiles = await walk("lib", (file) => /\.(ts|tsx)$/.test(file))
const sourceFiles = [...appFiles, ...componentFiles, ...libFiles]
const schema = await readFile(path.join(projectRoot, "lib/db/schema.ts"), "utf8")

const baseline = {
  generatedAt: new Date().toISOString(),
  source: {
    routes: appFiles.filter((file) => file.endsWith("/page.tsx") || file === "app/page.tsx").length,
    clientComponents: await countMatchingFiles(
      [...appFiles, ...componentFiles],
      /^\s*["']use client["']/m,
    ),
    serverActionFiles: await countMatchingFiles(libFiles, /^\s*["']use server["']/m),
    localStorageFiles: await countMatchingFiles(sourceFiles, /\blocalStorage\b/),
    testFiles: sourceFiles.filter((file) => /\.(test|spec)\.(ts|tsx)$/.test(file)).length,
    databaseTables: [...schema.matchAll(/export const \w+ = pgTable\(/g)].length,
  },
  build: await buildChunkStats(),
  instrumentation: {
    productionAnalyticsComponent: appFiles.includes("app/layout.tsx"),
    customProductEvents: false,
    serverTiming: false,
    aiCostMetrics: false,
    databaseQueryMetrics: false,
  },
}

process.stdout.write(`${JSON.stringify(baseline, null, 2)}\n`)
