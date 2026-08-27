"use client"

import { useCallback, useEffect, useId, useState } from "react"

import type { TmapWalkingRoute } from "@/lib/timetable/tmap-contract"

const ROUTE_COLORS = ["#6d28d9", "#2563eb", "#059669", "#d97706", "#dc2626"]
const TMAP_SDK_READY_TIMEOUT_MS = 12_000

type TmapSdkState = "missing-key" | "loading" | "ready" | "failed"

export type TmapMapStop = {
  order: number
  building: string
  lat: number
  lng: number
}

type TmapRouteMapProps = {
  routes: TmapWalkingRoute[]
  stops: TmapMapStop[]
}

export function TmapRouteMap({ routes, stops }: TmapRouteMapProps) {
  const hasPublicMapKey = Boolean(process.env.NEXT_PUBLIC_TMAP_MAP_KEY?.trim())
  const [sdkState, setSdkState] = useState<TmapSdkState>(() => {
    if (!hasPublicMapKey) return "missing-key"
    if (typeof window !== "undefined" && window.Tmapv3?.Map) return "ready"
    return "loading"
  })

  useEffect(() => {
    if (sdkState !== "loading") return

    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      if (window.Tmapv3?.Map) {
        window.clearInterval(timer)
        setSdkState("ready")
        return
      }

      if (Date.now() - startedAt >= TMAP_SDK_READY_TIMEOUT_MS) {
        window.clearInterval(timer)
        setSdkState("failed")
      }
    }, 100)

    return () => window.clearInterval(timer)
  }, [sdkState])

  const handleCanvasError = useCallback(() => setSdkState("failed"), [])

  if (sdkState === "missing-key" || sdkState === "failed") {
    return (
      <div>
        <RouteOutline routes={routes} stops={stops} />
        <p className="border-t border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
          {sdkState === "missing-key"
            ? "TMAP 공개 지도 키가 배포 환경에 없어 실제 경로 윤곽만 표시하고 있어요."
            : "TMAP 지도 SDK를 불러오지 못해 실제 경로 윤곽만 표시하고 있어요. 새로고침 후에도 계속되면 Vector Map 권한과 허용 도메인을 확인해 주세요."}
        </p>
      </div>
    )
  }

  return sdkState === "ready" ? (
    <TmapVectorCanvas routes={routes} stops={stops} onError={handleCanvasError} />
  ) : (
    <div className="flex aspect-square min-h-72 w-full items-center justify-center bg-muted/40 md:aspect-video" role="status">
      <span className="text-sm text-muted-foreground">TMAP 지도를 불러오는 중…</span>
    </div>
  )
}

function TmapVectorCanvas({
  routes,
  stops,
  onError,
}: TmapRouteMapProps & {
  onError: () => void
}) {
  const rawId = useId()
  const containerId = `tmap-route-${rawId.replaceAll(":", "")}`

  useEffect(() => {
    const sdk = window.Tmapv3
    if (!sdk?.Map) {
      const frame = window.requestAnimationFrame(onError)
      return () => window.cancelAnimationFrame(frame)
    }

    const allPoints = routes.flatMap((route) => route.lines.flat())
    if (allPoints.length === 0) {
      const frame = window.requestAnimationFrame(onError)
      return () => window.cancelAnimationFrame(frame)
    }
    const center = allPoints.reduce(
      (sum, [lng, lat]) => ({ lat: sum.lat + lat, lng: sum.lng + lng }),
      { lat: 0, lng: 0 },
    )
    center.lat /= allPoints.length
    center.lng /= allPoints.length
    const latitudes = allPoints.map(([, lat]) => lat)
    const longitudes = allPoints.map(([lng]) => lng)
    const span = Math.max(
      Math.max(...latitudes) - Math.min(...latitudes),
      Math.max(...longitudes) - Math.min(...longitudes),
    )
    const zoom = span > 0.02 ? 13 : span > 0.01 ? 14 : span > 0.005 ? 15 : 17
    const overlays: TmapVectorOverlay[] = []
    let map: TmapVectorMap | undefined

    try {
      const initializedMap = new sdk.Map(containerId, {
        center: new sdk.LatLng(center.lat, center.lng),
        width: "100%",
        height: "100%",
        zoom,
        zoomControl: true,
        scrollwheel: true,
      })
      map = initializedMap

      routes.forEach((route, routeIndex) => {
        route.lines.forEach((line) => {
          const overlay = new sdk.Polyline({
            path: line.map(([lng, lat]) => new sdk.LatLng(lat, lng)),
            strokeColor: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
            strokeWeight: 6,
            strokeOpacity: 0.88,
            direction: true,
            map: initializedMap,
          })
          overlays.push(overlay)
        })
      })

      stops.forEach((stop) => {
        overlays.push(
          new sdk.Marker({
            position: new sdk.LatLng(stop.lat, stop.lng),
            title: `${stop.order}. ${stop.building}`,
            label: String(stop.order),
            map: initializedMap,
          }),
        )
      })
    } catch (error) {
      overlays.forEach((overlay) => overlay.setMap(null))
      map?.destroy?.()
      console.error("TMAP 지도를 초기화하지 못했습니다.", error)
      const frame = window.requestAnimationFrame(onError)
      return () => window.cancelAnimationFrame(frame)
    }

    return () => {
      overlays.forEach((overlay) => overlay.setMap(null))
      map?.destroy?.()
    }
  }, [containerId, onError, routes, stops])

  return <div id={containerId} className="aspect-square min-h-72 w-full md:aspect-video" aria-label="TMAP 실제 보행 경로 지도" />
}

function RouteOutline({ routes, stops }: TmapRouteMapProps) {
  const allPoints = [
    ...routes.flatMap((route) => route.lines.flat()),
    ...stops.map((stop) => [stop.lng, stop.lat] as [number, number]),
  ]
  if (allPoints.length === 0) {
    return <div className="aspect-square w-full bg-muted/40 md:aspect-video" />
  }

  const lngs = allPoints.map(([lng]) => lng)
  const lats = allPoints.map(([, lat]) => lat)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const lngSpan = Math.max(maxLng - minLng, 0.0001)
  const latSpan = Math.max(maxLat - minLat, 0.0001)
  const project = ([lng, lat]: [number, number]) => ({
    x: 5 + ((lng - minLng) / lngSpan) * 90,
    y: 95 - ((lat - minLat) / latSpan) * 90,
  })

  return (
    <svg
      viewBox="0 0 100 100"
      className="aspect-square w-full bg-[radial-gradient(circle_at_center,var(--color-muted)_1px,transparent_1px)] [background-size:12px_12px] md:aspect-video"
      role="img"
      aria-label="TMAP 실제 보행 경로 윤곽"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>TMAP 실제 보행 경로 윤곽</title>
      {routes.map((route, routeIndex) =>
        route.lines.map((line, lineIndex) => (
          <polyline
            key={`${routeIndex}-${lineIndex}`}
            points={line.map((point) => {
              const projected = project(point)
              return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`
            }).join(" ")}
            fill="none"
            stroke={ROUTE_COLORS[routeIndex % ROUTE_COLORS.length]}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )),
      )}
      {stops.map((stop) => {
        const point = project([stop.lng, stop.lat])
        return (
          <g key={`${stop.order}-${stop.building}`}>
            <circle cx={point.x} cy={point.y} r="3.4" className="fill-card stroke-primary" strokeWidth="1" />
            <text x={point.x} y={point.y + 1.2} textAnchor="middle" className="fill-primary text-[4px] font-bold">
              {stop.order}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
