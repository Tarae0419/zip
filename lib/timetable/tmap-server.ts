import buildingCoordinatesData from "./building-coordinates.json"
import {
  getTmapBuildingKey,
  type TmapBuildingKey,
  type TmapRouteCoordinate,
  type TmapWalkingErrorCode,
  type TmapWalkingLegRequest,
  type TmapWalkingLegResult,
  type TmapWalkingResponse,
  type TmapWalkingRoute,
} from "./tmap-contract"

const TMAP_PEDESTRIAN_URL =
  "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json"
const TMAP_REQUEST_TIMEOUT_MS = 8_000
export const TMAP_ROUTE_CACHE_TTL_MS = 23 * 60 * 60 * 1_000
const TMAP_ROUTE_CACHE_MAX_ENTRIES = 256
const MAX_ROUTE_POINTS = 5_000

type BuildingCoordinate = {
  campus: string
  building: string
  lat: number
  lng: number
  needsReview?: boolean
}

type AllowedBuilding = BuildingCoordinate & { key: TmapBuildingKey }
type CacheEntry = { expiresAt: number; route: TmapWalkingRoute }
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type ServiceOptions = {
  fetcher?: FetchLike
  getApiKey?: () => string | undefined
  now?: () => number
}

const JEONJU_BOUNDS = {
  minLat: 35.82,
  maxLat: 35.88,
  minLng: 127.1,
  maxLng: 127.17,
} as const

function isInsideJeonjuBounds(coordinate: BuildingCoordinate): boolean {
  return (
    Number.isFinite(coordinate.lat) &&
    coordinate.lat >= JEONJU_BOUNDS.minLat &&
    coordinate.lat <= JEONJU_BOUNDS.maxLat &&
    Number.isFinite(coordinate.lng) &&
    coordinate.lng >= JEONJU_BOUNDS.minLng &&
    coordinate.lng <= JEONJU_BOUNDS.maxLng
  )
}

const allowedBuildingByKey = new Map<TmapBuildingKey, AllowedBuilding>(
  (buildingCoordinatesData as BuildingCoordinate[])
    .filter((coordinate) => coordinate.campus === "전주" && isInsideJeonjuBounds(coordinate))
    .map((coordinate) => {
      const key = getTmapBuildingKey(coordinate)
      return [key, { ...coordinate, key }]
    }),
)

function providerError(status: number): TmapWalkingErrorCode {
  if (status === 401 || status === 403) return "PROVIDER_AUTH"
  if (status === 429) return "PROVIDER_QUOTA"
  return "PROVIDER_UNAVAILABLE"
}

function isRouteCoordinate(value: unknown): value is TmapRouteCoordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[1] >= 33 &&
    value[1] <= 39.5 &&
    value[0] >= 124 &&
    value[0] <= 132
  )
}

export function normalizeTmapRoute(payload: unknown): TmapWalkingRoute | null {
  if (!payload || typeof payload !== "object" || !("features" in payload) || !Array.isArray(payload.features)) {
    return null
  }

  let distanceMeters: number | null = null
  let durationSeconds: number | null = null
  const lines: TmapRouteCoordinate[][] = []
  let pointCount = 0

  for (const feature of payload.features) {
    if (!feature || typeof feature !== "object") continue

    if ("properties" in feature && feature.properties && typeof feature.properties === "object") {
      if ("totalDistance" in feature.properties && "totalTime" in feature.properties) {
        const distance = Number(feature.properties.totalDistance)
        const duration = Number(feature.properties.totalTime)
        if (Number.isFinite(distance) && distance >= 0 && Number.isFinite(duration) && duration >= 0) {
          distanceMeters = distance
          durationSeconds = duration
        }
      }
    }

    if (!("geometry" in feature) || !feature.geometry || typeof feature.geometry !== "object") continue
    if (!("type" in feature.geometry) || feature.geometry.type !== "LineString") continue
    if (!("coordinates" in feature.geometry) || !Array.isArray(feature.geometry.coordinates)) continue

    const coordinates = feature.geometry.coordinates.filter(isRouteCoordinate)
    if (coordinates.length < 2 || coordinates.length !== feature.geometry.coordinates.length) continue
    pointCount += coordinates.length
    if (pointCount > MAX_ROUTE_POINTS) return null
    lines.push(coordinates)
  }

  if (distanceMeters === null || durationSeconds === null || lines.length === 0) return null
  return { distanceMeters, durationSeconds, lines }
}

function routeCacheKey(from: AllowedBuilding, to: AllowedBuilding): string {
  return [
    "pedestrian-v1",
    "search-0",
    from.lat.toFixed(7),
    from.lng.toFixed(7),
    to.lat.toFixed(7),
    to.lng.toFixed(7),
  ].join("|")
}

function trimCache(cache: Map<string, CacheEntry>, now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  while (cache.size >= TMAP_ROUTE_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (typeof oldestKey !== "string") break
    cache.delete(oldestKey)
  }
}

function validationError(
  index: number,
  leg: TmapWalkingLegRequest,
  code: TmapWalkingErrorCode,
): TmapWalkingLegResult {
  return {
    index,
    fromBuildingKey: leg.fromBuildingKey,
    toBuildingKey: leg.toBuildingKey,
    status: "error",
    code,
  }
}

export function createTmapWalkingService(options: ServiceOptions = {}) {
  const fetcher = options.fetcher ?? fetch
  const getApiKey = options.getApiKey ?? (() => process.env.TMAP_API_KEY)
  const now = options.now ?? Date.now
  const cache = new Map<string, CacheEntry>()
  const inFlight = new Map<string, Promise<TmapWalkingRoute>>()

  async function fetchProviderRoute(
    apiKey: string,
    from: AllowedBuilding,
    to: AllowedBuilding,
  ): Promise<TmapWalkingRoute> {
    const form = new URLSearchParams({
      appKey: apiKey,
      startX: String(from.lng),
      startY: String(from.lat),
      endX: String(to.lng),
      endY: String(to.lat),
      reqCoordType: "WGS84GEO",
      resCoordType: "WGS84GEO",
      startName: from.building,
      endName: to.building,
      searchOption: "0",
    })
    const response = await fetcher(TMAP_PEDESTRIAN_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form,
      signal: AbortSignal.timeout(TMAP_REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new TmapProviderError(providerError(response.status))
    }
    const route = normalizeTmapRoute(await response.json().catch(() => null))
    if (!route) throw new TmapProviderError("NO_ROUTE")
    return route
  }

  async function resolveLeg(leg: TmapWalkingLegRequest, index: number): Promise<TmapWalkingLegResult> {
    const from = allowedBuildingByKey.get(leg.fromBuildingKey)
    const to = allowedBuildingByKey.get(leg.toBuildingKey)
    if (!from || !to) return validationError(index, leg, "UNKNOWN_BUILDING")
    if (from.campus !== "전주" || to.campus !== "전주") {
      return validationError(index, leg, "UNSUPPORTED_CAMPUS")
    }
    if (from.needsReview || to.needsReview) {
      return validationError(index, leg, "COORDINATE_UNVERIFIED")
    }
    if (from.key === to.key || (from.lat === to.lat && from.lng === to.lng)) {
      return validationError(index, leg, "SAME_LOCATION")
    }

    const apiKey = getApiKey()?.trim()
    if (!apiKey) return validationError(index, leg, "TMAP_NOT_CONFIGURED")

    const key = routeCacheKey(from, to)
    const currentTime = now()
    const cached = cache.get(key)
    if (cached && cached.expiresAt > currentTime) {
      cache.delete(key)
      cache.set(key, cached)
      return { index, ...leg, status: "ok", cache: "hit", route: cached.route }
    }

    try {
      const sharedRequest = inFlight.get(key)
      const route = sharedRequest ?? fetchProviderRoute(apiKey, from, to)
      if (!sharedRequest) inFlight.set(key, route)
      const result = await route
      trimCache(cache, currentTime)
      cache.set(key, { expiresAt: currentTime + TMAP_ROUTE_CACHE_TTL_MS, route: result })
      return { index, ...leg, status: "ok", cache: sharedRequest ? "shared" : "miss", route: result }
    } catch (error) {
      if (error instanceof TmapProviderError) return validationError(index, leg, error.code)
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        return validationError(index, leg, "PROVIDER_TIMEOUT")
      }
      return validationError(index, leg, "PROVIDER_UNAVAILABLE")
    } finally {
      inFlight.delete(key)
    }
  }

  async function resolve(legs: TmapWalkingLegRequest[]): Promise<TmapWalkingResponse> {
    const results = await Promise.all(legs.map(resolveLeg))
    const successful = results.filter(
      (leg): leg is Extract<TmapWalkingLegResult, { status: "ok" }> => leg.status === "ok",
    )

    return {
      provider: "tmap",
      complete: successful.length === results.length,
      successCount: successful.length,
      totalDistanceMeters: successful.reduce((sum, leg) => sum + leg.route.distanceMeters, 0),
      totalDurationSeconds: successful.reduce((sum, leg) => sum + leg.route.durationSeconds, 0),
      legs: results,
    }
  }

  return { resolve }
}

class TmapProviderError extends Error {
  constructor(readonly code: TmapWalkingErrorCode) {
    super(code)
    this.name = "TmapProviderError"
  }
}

export const tmapWalkingService = createTmapWalkingService()
