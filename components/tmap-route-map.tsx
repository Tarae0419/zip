"use client"

import { useEffect, useId, useState } from "react"
import Script from "next/script"

import type { TmapWalkingRoute } from "@/lib/timetable/tmap-contract"

const ROUTE_COLORS = ["#6d28d9", "#2563eb", "#059669", "#d97706", "#dc2626"]

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
  const publicMapKey = process.env.NEXT_PUBLIC_TMAP_MAP_KEY
  const [sdkState, setSdkState] = useState<"loading" | "ready" | "failed">("loading")

  if (!publicMapKey || sdkState === "failed") {
    return (
      <div>
        <RouteOutline routes={routes} stops={stops} />
        <p className="border-t border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
          TMAP 실제 경로 윤곽이에요. 공개 지도 키가 설정되면 같은 경로를 TMAP 바탕지도에서 보여줘요.
        </p>
      </div>
    )
  }

  return (
    <>
      <Script
        id="tmap-vector-sdk"
        src={`https://apis.openapi.sk.com/tmap/vectorjs?version=1&appKey=${encodeURIComponent(publicMapKey)}`}
        strategy="afterInteractive"
        onLoad={() => setSdkState(window.Tmapv3 ? "ready" : "failed")}
        onReady={() => setSdkState(window.Tmapv3 ? "ready" : "failed")}
        onError={() => setSdkState("failed")}
      />
      {sdkState === "ready" ? (
        <TmapVectorCanvas routes={routes} stops={stops} />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-muted/40 md:aspect-video" role="status">
          <span className="text-sm text-muted-foreground">TMAP 지도를 불러오는 중…</span>
        </div>
      )}
    </>
  )
}

function TmapVectorCanvas({ routes, stops }: TmapRouteMapProps) {
  const rawId = useId()
  const containerId = `tmap-route-${rawId.replaceAll(":", "")}`

  useEffect(() => {
    const sdk = window.Tmapv3
    if (!sdk) return

    const allPoints = routes.flatMap((route) => route.lines.flat())
    if (allPoints.length === 0) return
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
    const map = new sdk.Map(containerId, {
      center: new sdk.LatLng(center.lat, center.lng),
      width: "100%",
      height: "100%",
      zoom,
      zoomControl: true,
      scrollwheel: true,
    })
    const overlays: TmapVectorOverlay[] = []

    routes.forEach((route, routeIndex) => {
      route.lines.forEach((line) => {
        const overlay = new sdk.Polyline({
          path: line.map(([lng, lat]) => new sdk.LatLng(lat, lng)),
          strokeColor: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
          strokeWeight: 6,
          strokeOpacity: 0.88,
          direction: true,
          map,
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
          map,
        }),
      )
    })

    return () => {
      overlays.forEach((overlay) => overlay.setMap(null))
      map.destroy?.()
    }
  }, [containerId, routes, stops])

  return <div id={containerId} className="aspect-square w-full md:aspect-video" aria-label="TMAP 실제 보행 경로 지도" />
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
