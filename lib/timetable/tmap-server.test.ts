import { describe, expect, it, vi } from "vitest"

import { getTmapBuildingKey } from "./tmap-contract"
import { createTmapWalkingService, normalizeTmapRoute, TMAP_ROUTE_CACHE_TTL_MS } from "./tmap-server"

const fromBuildingKey = getTmapBuildingKey({ campus: "전주", building: "공과대학 1호관" })
const toBuildingKey = getTmapBuildingKey({ campus: "전주", building: "공과대학 2호관" })
const thirdBuildingKey = getTmapBuildingKey({ campus: "전주", building: "공과대학 3호관" })

const providerPayload = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [127.1325, 35.8466] },
      properties: { totalDistance: 111, totalTime: 93 },
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [127.1325, 35.8466],
          [127.1316, 35.8469],
        ],
      },
      properties: {},
    },
  ],
}

describe("TMAP server adapter", () => {
  it("normalizes only totals and valid WGS84 LineStrings", () => {
    expect(normalizeTmapRoute(providerPayload)).toEqual({
      distanceMeters: 111,
      durationSeconds: 93,
      lines: [
        [
          [127.1325, 35.8466],
          [127.1316, 35.8469],
        ],
      ],
    })
    expect(normalizeTmapRoute({ features: [] })).toBeNull()
  })

  it("sends the key only in a form body and caches a successful route for under 24 hours", async () => {
    let now = 1_000
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).not.toContain("secret-app-key")
      expect(new Headers(init?.headers).get("appKey")).toBeNull()
      expect(new Headers(init?.headers).get("Content-Type")).toContain("application/x-www-form-urlencoded")
      expect(String(init?.body)).toContain("appKey=secret-app-key")
      return new Response(JSON.stringify(providerPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
    const service = createTmapWalkingService({
      fetcher,
      getApiKey: () => "secret-app-key",
      now: () => now,
    })
    const legs = [{ fromBuildingKey, toBuildingKey }]

    const first = await service.resolve(legs)
    const second = await service.resolve(legs)
    now += TMAP_ROUTE_CACHE_TTL_MS + 1
    const expired = await service.resolve(legs)

    expect(first.legs[0]).toMatchObject({ status: "ok", cache: "miss" })
    expect(second.legs[0]).toMatchObject({ status: "ok", cache: "hit" })
    expect(expired.legs[0]).toMatchObject({ status: "ok", cache: "miss" })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(TMAP_ROUTE_CACHE_TTL_MS).toBeLessThan(24 * 60 * 60 * 1_000)
  })

  it("rejects unknown or unreviewed buildings without calling TMAP", async () => {
    const fetcher = vi.fn()
    const service = createTmapWalkingService({ fetcher, getApiKey: () => "key" })
    const response = await service.resolve([
      { fromBuildingKey: "unknown:from", toBuildingKey },
      {
        fromBuildingKey: getTmapBuildingKey({ campus: "전주", building: "의과대학 본관" }),
        toBuildingKey,
      },
    ])

    expect(response.legs[0]).toMatchObject({ status: "error", code: "UNKNOWN_BUILDING" })
    expect(response.legs[1]).toMatchObject({ status: "error", code: "COORDINATE_UNVERIFIED" })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("maps provider authentication failures without exposing the raw response", async () => {
    const service = createTmapWalkingService({
      getApiKey: () => "key",
      fetcher: async () => new Response(JSON.stringify({ error: { message: "secret provider detail" } }), { status: 403 }),
    })
    const response = await service.resolve([{ fromBuildingKey, toBuildingKey }])

    expect(response.legs[0]).toEqual({
      index: 0,
      fromBuildingKey,
      toBuildingKey,
      status: "error",
      code: "PROVIDER_AUTH",
    })
    expect(JSON.stringify(response)).not.toContain("secret provider detail")
  })

  it("keeps successful route totals when another leg fails", async () => {
    const service = createTmapWalkingService({
      getApiKey: () => "key",
      fetcher: async (_input, init) => {
        const form = new URLSearchParams(String(init?.body))
        if (form.get("endName") === "공과대학 3호관") {
          return new Response(null, { status: 503 })
        }
        return new Response(JSON.stringify(providerPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      },
    })
    const response = await service.resolve([
      { fromBuildingKey, toBuildingKey },
      { fromBuildingKey, toBuildingKey: thirdBuildingKey },
    ])

    expect(response).toMatchObject({
      complete: false,
      successCount: 1,
      totalDistanceMeters: 111,
      totalDurationSeconds: 93,
    })
    expect(response.legs[0]).toMatchObject({ status: "ok" })
    expect(response.legs[1]).toMatchObject({ status: "error", code: "PROVIDER_UNAVAILABLE" })
  })
})
