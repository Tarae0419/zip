import { readFile } from "node:fs/promises"
import process from "node:process"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local", quiet: true })

const TMAP_PEDESTRIAN_URL =
  "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json"
const REQUEST_TIMEOUT_MS = 10_000

const representativePairs = [
  ["공과대학 1호관", "공과대학 2호관"],
  ["공과대학 1호관", "자연과학대학1호관"],
  ["공과대학 7호관", "사회과학대학"],
  ["경상대학 1호관", "진수당"],
  ["인문대학1호관", "정보화 교육동"],
  ["사범대 본관", "예술대학 본관"],
  ["농업생명과학대학본관", "공과대학 5호관"],
  ["생명과학관", "약학대학 1호관"],
  ["치과대학 2호관", "의과대학 4호관(의생명융합관)"],
  ["골프학습장", "반도체물성 연구소"],
]

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function findProviderError(payload) {
  if (!payload || typeof payload !== "object") return null
  const error = payload.error
  if (!error || typeof error !== "object") return null
  return typeof error.code === "string" ? error.code : null
}

function summarizeRoute(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : []
  const totalProperties = features.find(
    (feature) =>
      Number.isFinite(feature?.properties?.totalDistance) &&
      Number.isFinite(feature?.properties?.totalTime),
  )?.properties
  const lineFeatures = features.filter(
    (feature) =>
      feature?.geometry?.type === "LineString" && Array.isArray(feature.geometry.coordinates),
  )

  if (!totalProperties || lineFeatures.length === 0) {
    return null
  }

  return {
    distanceMeters: totalProperties.totalDistance,
    durationSeconds: totalProperties.totalTime,
    lineStringCount: lineFeatures.length,
    pointCount: lineFeatures.reduce(
      (count, feature) => count + feature.geometry.coordinates.length,
      0,
    ),
  }
}

async function requestRoute(appKey, start, end) {
  const form = new URLSearchParams({
    appKey,
    startX: String(start.lng),
    startY: String(start.lat),
    endX: String(end.lng),
    endY: String(end.lat),
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
    startName: start.building,
    endName: end.building,
    searchOption: "0",
  })
  const response = await fetch(TMAP_PEDESTRIAN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    // Header 방식은 이 프로젝트 키에서 403으로 거절됐다. URL query는 프록시 로그에
    // 키가 남을 수 있으므로, TMAP 공식 예제와 호환되는 form body로만 전달한다.
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const payload = await response.json().catch(() => null)

  return {
    ok: response.ok,
    status: response.status,
    providerCode: findProviderError(payload),
    route: response.ok ? summarizeRoute(payload) : null,
  }
}

async function main() {
  const appKey = process.env.TMAP_API_KEY?.trim()
  if (!appKey) {
    fail("TMAP_API_KEY가 .env.local에 없습니다.")
    return
  }

  const coordinates = JSON.parse(
    await readFile(new URL("../lib/timetable/building-coordinates.json", import.meta.url), "utf8"),
  )
  const coordinateByBuilding = new Map(
    coordinates
      .filter((coordinate) => coordinate.campus === "전주")
      .map((coordinate) => [coordinate.building, coordinate]),
  )
  const requestedPairs = process.argv.includes("--all")
    ? representativePairs
    : representativePairs.slice(0, 1)

  console.log(
    `TMAP 보행 경로 ${requestedPairs.length}개 구간 검증을 시작합니다. 키와 경로 geometry는 출력하거나 저장하지 않습니다.`,
  )

  const results = []
  for (const [startName, endName] of requestedPairs) {
    const start = coordinateByBuilding.get(startName)
    const end = coordinateByBuilding.get(endName)
    if (!start || !end) {
      results.push({ start: startName, end: endName, status: "COORDINATE_MISSING" })
      continue
    }

    try {
      const result = await requestRoute(appKey, start, end)
      results.push({
        start: startName,
        end: endName,
        status: result.ok ? "OK" : "PROVIDER_REJECTED",
        httpStatus: result.status,
        providerCode: result.providerCode,
        ...(result.route ?? {}),
      })

      if (result.status === 401 || result.status === 403) {
        console.table(results)
        fail(
          "TMAP이 appKey를 거절했습니다. SK open API 프로젝트의 App Key와 TMAP 상품 신청 상태를 확인하세요.",
        )
        return
      }
    } catch (error) {
      results.push({
        start: startName,
        end: endName,
        status: error?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK_ERROR",
      })
    }
  }

  console.table(results)
  if (results.some((result) => result.status !== "OK")) {
    fail("일부 대표 구간 검증에 실패했습니다.")
  }
}

await main()
