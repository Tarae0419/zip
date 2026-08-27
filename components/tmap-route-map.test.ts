import { describe, expect, it, vi } from "vitest"

import { attachTmapRouteOverlays, type TmapMapStop } from "./tmap-route-map"
import type { TmapWalkingRoute } from "@/lib/timetable/tmap-contract"

type FakeLatLngValue = TmapVectorLatLng & { lat: number; lng: number }
type PolylineOptions = ConstructorParameters<TmapVectorNamespace["Polyline"]>[0]
type MarkerOptions = ConstructorParameters<TmapVectorNamespace["Marker"]>[0]

function createHarness() {
  let configLoadListener: (() => void) | undefined
  const polylines: Array<{ options: PolylineOptions; setMap: ReturnType<typeof vi.fn> }> = []
  const markers: Array<{ options: MarkerOptions; setMap: ReturnType<typeof vi.fn> }> = []

  class FakeLatLng {
    constructor(
      public lat: number,
      public lng: number,
    ) {}
  }

  class FakePolyline {
    readonly setMap = vi.fn()

    constructor(readonly options: PolylineOptions) {
      polylines.push(this)
    }
  }

  class FakeMarker {
    readonly setMap = vi.fn()

    constructor(readonly options: MarkerOptions) {
      markers.push(this)
    }
  }

  class FakeLatLngBounds {
    readonly points: TmapVectorLatLng[]

    constructor(coordinate: TmapVectorLatLng) {
      this.points = [coordinate]
    }

    extend(coordinate: TmapVectorLatLng) {
      this.points.push(coordinate)
    }
  }

  const map = {
    on: vi.fn((_eventName: "ConfigLoad", listener: () => void) => {
      configLoadListener = listener
    }),
    off: vi.fn(),
    fitBounds: vi.fn(),
  } satisfies TmapVectorMap
  const sdk = {
    LatLng: FakeLatLng,
    LatLngBounds: FakeLatLngBounds,
    Polyline: FakePolyline,
    Marker: FakeMarker,
  } as unknown as TmapVectorNamespace

  return {
    configLoad: () => configLoadListener?.(),
    map,
    markers,
    polylines,
    sdk,
  }
}

const routes: TmapWalkingRoute[] = [
  {
    distanceMeters: 111,
    durationSeconds: 93,
    lines: [
      [
        [127.1, 35.8],
        [127.2, 35.9],
      ],
      [
        [127.2, 35.9],
        [127.3, 36],
      ],
    ],
  },
]

const stops: TmapMapStop[] = [
  { order: 1, building: "공과대학 1호관", lat: 35.8, lng: 127.1 },
  { order: 2, building: "공과대학 2호관", lat: 36, lng: 127.3 },
]

describe("TMAP route overlays", () => {
  it("draws each route line and stop only after ConfigLoad", () => {
    const harness = createHarness()
    const onError = vi.fn()
    const controller = attachTmapRouteOverlays(
      harness.sdk,
      harness.map,
      routes,
      stops,
      onError,
    )

    expect(harness.map.on).toHaveBeenCalledWith("ConfigLoad", expect.any(Function))
    expect(harness.polylines).toHaveLength(0)
    expect(harness.markers).toHaveLength(0)

    harness.configLoad()

    expect(controller.hasDrawn()).toBe(true)
    expect(harness.polylines).toHaveLength(2)
    expect(harness.markers).toHaveLength(2)
    expect(harness.polylines[0].options.map).toBe(harness.map)
    expect(harness.markers[0].options.map).toBe(harness.map)
    expect(harness.map.fitBounds).toHaveBeenCalledWith(expect.anything(), 40)
    expect(harness.polylines[0].options.path[0] as FakeLatLngValue).toMatchObject({
      lat: 35.8,
      lng: 127.1,
    })
    expect(onError).not.toHaveBeenCalled()

    harness.configLoad()
    expect(harness.polylines).toHaveLength(2)
    expect(harness.markers).toHaveLength(2)

    controller.dispose()
    expect(harness.map.off).toHaveBeenCalledWith("ConfigLoad", expect.any(Function))
    for (const overlay of [...harness.polylines, ...harness.markers]) {
      expect(overlay.setMap).toHaveBeenCalledWith(null)
    }
  })

  it("ignores a late ConfigLoad event after cleanup", () => {
    const harness = createHarness()
    const controller = attachTmapRouteOverlays(
      harness.sdk,
      harness.map,
      routes,
      stops,
      vi.fn(),
    )

    controller.dispose()
    harness.configLoad()

    expect(harness.polylines).toHaveLength(0)
    expect(harness.markers).toHaveLength(0)
  })
})
