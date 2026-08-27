import { describe, expect, it } from "vitest"

import {
  getTmapBuildingKey,
  MAX_TMAP_WALKING_LEGS,
  parseTmapWalkingRequest,
} from "./tmap-contract"

describe("TMAP walking contract", () => {
  it("creates a deterministic readable key from a registered location", () => {
    expect(getTmapBuildingKey({ campus: "전주", building: "공과대학 1호관" })).toBe(
      "%EC%A0%84%EC%A3%BC:%EA%B3%B5%EA%B3%BC%EB%8C%80%ED%95%99%201%ED%98%B8%EA%B4%80",
    )
  })

  it("accepts only a bounded list of building-key pairs", () => {
    const leg = { fromBuildingKey: "campus:from", toBuildingKey: "campus:to" }
    expect(parseTmapWalkingRequest({ legs: [leg] })).toEqual({ legs: [leg] })
    expect(parseTmapWalkingRequest({ legs: [] })).toBeNull()
    expect(parseTmapWalkingRequest({ legs: Array(MAX_TMAP_WALKING_LEGS + 1).fill(leg) })).toBeNull()
    expect(parseTmapWalkingRequest({ legs: [{ ...leg, fromBuildingKey: 1 }] })).toBeNull()
    expect(parseTmapWalkingRequest({ legs: [{ ...leg, toBuildingKey: "x" }] })).toBeNull()
  })

  it("rejects extra fields, including client-supplied coordinates", () => {
    expect(
      parseTmapWalkingRequest({
        legs: [{ fromBuildingKey: "campus:from", toBuildingKey: "campus:to", lat: 35.8 }],
      }),
    ).toBeNull()
    expect(
      parseTmapWalkingRequest({
        legs: [{ fromBuildingKey: "campus:from", toBuildingKey: "campus:to" }],
        startX: 127.1,
      }),
    ).toBeNull()
  })
})
