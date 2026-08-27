import type { ParsedLocation } from "./types"

export const MAX_TMAP_WALKING_LEGS = 9

export type TmapBuildingKey = string

export type TmapWalkingLegRequest = {
  fromBuildingKey: TmapBuildingKey
  toBuildingKey: TmapBuildingKey
}

export type TmapWalkingRequest = {
  legs: TmapWalkingLegRequest[]
}

export type TmapRouteCoordinate = [lng: number, lat: number]

export type TmapWalkingRoute = {
  distanceMeters: number
  durationSeconds: number
  lines: TmapRouteCoordinate[][]
}

export type TmapWalkingErrorCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_BUILDING"
  | "UNSUPPORTED_CAMPUS"
  | "COORDINATE_UNVERIFIED"
  | "SAME_LOCATION"
  | "TMAP_NOT_CONFIGURED"
  | "PROVIDER_AUTH"
  | "PROVIDER_QUOTA"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "NO_ROUTE"

export type TmapWalkingLegResult =
  | {
      index: number
      fromBuildingKey: TmapBuildingKey
      toBuildingKey: TmapBuildingKey
      status: "ok"
      cache: "hit" | "miss" | "shared"
      route: TmapWalkingRoute
    }
  | {
      index: number
      fromBuildingKey: TmapBuildingKey
      toBuildingKey: TmapBuildingKey
      status: "error"
      code: TmapWalkingErrorCode
    }

export type TmapWalkingResponse = {
  provider: "tmap"
  complete: boolean
  successCount: number
  totalDistanceMeters: number
  totalDurationSeconds: number
  legs: TmapWalkingLegResult[]
}

export function getTmapBuildingKey(location: Pick<ParsedLocation, "campus" | "building">): TmapBuildingKey {
  return `${encodeURIComponent(location.campus)}:${encodeURIComponent(location.building)}`
}

export function parseTmapWalkingRequest(value: unknown): TmapWalkingRequest | null {
  if (!value || typeof value !== "object" || !("legs" in value) || !Array.isArray(value.legs)) {
    return null
  }
  if (Object.keys(value).length !== 1) return null
  if (value.legs.length < 1 || value.legs.length > MAX_TMAP_WALKING_LEGS) return null

  const legs: TmapWalkingLegRequest[] = []
  for (const leg of value.legs) {
    if (!leg || typeof leg !== "object") return null
    if (
      Object.keys(leg).length !== 2 ||
      Object.keys(leg).some((key) => key !== "fromBuildingKey" && key !== "toBuildingKey")
    ) {
      return null
    }
    if (!("fromBuildingKey" in leg) || !("toBuildingKey" in leg)) return null
    if (typeof leg.fromBuildingKey !== "string" || typeof leg.toBuildingKey !== "string") return null
    if (leg.fromBuildingKey.length < 3 || leg.fromBuildingKey.length > 180) return null
    if (leg.toBuildingKey.length < 3 || leg.toBuildingKey.length > 180) return null
    legs.push({
      fromBuildingKey: leg.fromBuildingKey,
      toBuildingKey: leg.toBuildingKey,
    })
  }

  return { legs }
}
