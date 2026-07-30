"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { MapPin, Info } from "lucide-react"
import type { CampusStop, CartCourse, Weekday } from "@/lib/timetable/types"
import {
  buildCampusStops,
  estimateWalkMinutes,
  formatMinutes,
  getBuildingPosition,
  getRealCoordinate,
  getSessionsForDay,
} from "@/lib/timetable/schedule"

const ORDER_LABELS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY
const ROUTE_LINE_COLOR = "#7c3aed" // 앱 --primary(oklch 보라 계열) 근사 hex — 카카오맵 SDK는 CSS 변수를 못 읽는다.

function orderLabel(order: number): string {
  return ORDER_LABELS[order - 1] ?? `#${order}`
}

// 카카오맵 JS SDK는 공식 타입 패키지를 따로 설치하지 않아 window.kakao를 any로 다룬다 —
// 이 파일 안에서만 쓰는 좁은 범위라 별도 타입 정의 패키지를 추가할 정도는 아니라고 판단.
declare global {
  interface Window {
    kakao?: any
  }
}

export function CampusMap({ day, cart }: { day: Weekday; cart: CartCourse[] }) {
  const sessions = getSessionsForDay(cart, day)

  if (sessions.length === 0) {
    return (
      <EmptyNotice
        title={`${day}요일에는 담은 강의가 없어요`}
        description="시간표에 강의가 없는 요일이라 이동동선도 표시할 게 없어요."
      />
    )
  }

  const stops = buildCampusStops(sessions)
  const unlocatedCourseNames = [...new Set(sessions.filter((s) => !s.location).map((s) => s.courseName))]

  if (stops.length === 0) {
    return (
      <EmptyNotice
        title="강의실 정보가 없어 지도를 표시할 수 없어요"
        description={`${unlocatedCourseNames.join(", ")} 과목에 강의실 정보가 없어요.`}
      />
    )
  }

  const primaryCampus = stops[0].location.campus
  const mapStops = stops.filter((s) => s.location.campus === primaryCampus)
  const geoStops = mapStops
    .map((stop) => ({ stop, coord: getRealCoordinate(stop.location) }))
    .filter((s): s is { stop: CampusStop; coord: { lat: number; lng: number } } => s.coord !== null)
  const missingCoordBuildings = [...new Set(mapStops.filter((s) => !getRealCoordinate(s.location)).map((s) => s.location.building))]
  const useRealMap = Boolean(KAKAO_JS_KEY) && geoStops.length > 0

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start gap-2 rounded-lg bg-accent/50 px-3 py-2 text-xs text-accent-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <p>
          {useRealMap
            ? "실제 지도 기반이에요. 이동 시간은 건물 간 직선거리로 추정한 값이라 실제 도보 경로와는 다를 수 있어요."
            : "실제 캠퍼스 배치와 다를 수 있는 예시(스케매틱) 지도예요. 이동 시간은 건물 좌표 거리 기반 추정치이며 실제 도보 경로를 측정한 값이 아니에요."}
        </p>
      </div>

      {stops.length === 1 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          이동이 없는 날이에요 — 하루 종일 <span className="font-semibold text-foreground">{stops[0].location.building}</span>에서
          수업이 있어요.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          이 날은 건물을 {mapStops.length}곳 이동해요. 아래 지도에서 ①→②→③ 순서로 확인해보세요.
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-secondary/30">
        {useRealMap ? (
          <KakaoCampusMap geoStops={geoStops} />
        ) : (
          <SchematicMap mapStops={mapStops} />
        )}
      </div>

      <ol className="mt-4 space-y-2">
        {stops.map((stop, i) => {
          const prevStop = stops[i - 1]
          const offCampusJump = prevStop && prevStop.location.campus !== stop.location.campus
          return (
            <li key={stop.order}>
              {i > 0 && !offCampusJump && (
                <p className="pl-1 text-xs text-muted-foreground">
                  도보 이동 약 {estimateWalkMinutes(prevStop.location, stop.location)}분 (추정)
                </p>
              )}
              {offCampusJump && (
                <p className="pl-1 text-xs font-medium text-destructive">
                  ⚠ {prevStop.location.campus} 캠퍼스 → {stop.location.campus} 캠퍼스 이동 — 캠퍼스 간 이동이라 도보
                  이동시간을 추정하지 않아요.
                </p>
              )}
              <div className="mt-1 flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <span className="mt-0.5 font-bold text-primary">{orderLabel(stop.order)}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                    <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {stop.location.campus} · {stop.location.building} {stop.location.room}호
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {stop.sessions
                      .map((s) => `${s.courseName} (${formatMinutes(s.startMinutes)}~${formatMinutes(s.endMinutes)})`)
                      .join(", ")}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {unlocatedCourseNames.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          강의실 정보가 없어 지도에 표시하지 못한 과목: {unlocatedCourseNames.join(", ")}
        </p>
      )}
      {useRealMap && missingCoordBuildings.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          정확한 좌표를 찾지 못해 지도 핀으로는 안 뜨는 건물(목록에는 포함): {missingCoordBuildings.join(", ")}
        </p>
      )}
    </div>
  )
}

/** 카카오맵 SDK로 그리는 실제 지도 — 정류지에 번호 핀을 찍고 순서대로 선으로 잇는다. */
function KakaoCampusMap({ geoStops }: { geoStops: { stop: CampusStop; coord: { lat: number; lng: number } }[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const [sdkReady, setSdkReady] = useState(false)

  function loadSdk() {
    if (!window.kakao?.maps) return
    window.kakao.maps.load(() => setSdkReady(true))
  }

  // next/script의 onLoad는 이 스크립트를 "처음" 로드한 컴포넌트 인스턴스에서만 불릴 수 있어
  // (다른 화면에서 먼저 로드해둔 경우 등) mount 시점에 이미 로드돼 있는지도 직접 확인한다.
  useEffect(() => {
    loadSdk()
  }, [])

  useEffect(() => {
    if (!sdkReady || !containerRef.current || geoStops.length === 0) return
    const kakao = window.kakao

    if (!mapRef.current) {
      mapRef.current = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(geoStops[0].coord.lat, geoStops[0].coord.lng),
        level: 4,
      })
    }
    const map = mapRef.current

    overlaysRef.current.forEach((overlay) => overlay.setMap(null))
    overlaysRef.current = []

    const bounds = new kakao.maps.LatLngBounds()
    const path: any[] = []

    for (const { stop, coord } of geoStops) {
      const position = new kakao.maps.LatLng(coord.lat, coord.lng)
      bounds.extend(position)
      path.push(position)

      const content = document.createElement("div")
      content.className =
        "flex size-7 items-center justify-center rounded-full border-2 border-primary bg-card text-xs font-bold text-primary shadow-md"
      content.textContent = String(stop.order)
      const overlay = new kakao.maps.CustomOverlay({ position, content, yAnchor: 0.5 })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)
    }

    if (path.length > 1) {
      const polyline = new kakao.maps.Polyline({
        path,
        strokeWeight: 3,
        strokeColor: ROUTE_LINE_COLOR,
        strokeOpacity: 0.8,
        strokeStyle: "solid",
      })
      polyline.setMap(map)
      overlaysRef.current.push(polyline)
    }

    map.setBounds(bounds)
  }, [sdkReady, geoStops])

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`}
        strategy="afterInteractive"
        onLoad={loadSdk}
      />
      <div ref={containerRef} className="aspect-square w-full md:aspect-video" />
    </>
  )
}

/** 카카오맵 키가 없거나 좌표를 하나도 못 찾았을 때의 폴백 — 건물명 해시 기반 추정 배치 SVG. */
function SchematicMap({ mapStops }: { mapStops: CampusStop[] }) {
  return (
    <svg viewBox="0 0 100 100" className="aspect-square w-full">
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" className="fill-primary" />
        </marker>
      </defs>

      {mapStops.slice(1).map((stop, i) => {
        const prev = mapStops[i]
        const p1 = getBuildingPosition(prev.location)
        const p2 = getBuildingPosition(stop.location)
        return (
          <line
            key={`arrow-${stop.order}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            className="stroke-primary/70"
            strokeWidth={1.2}
            markerEnd="url(#arrowhead)"
          />
        )
      })}

      {mapStops.map((stop) => {
        const p = getBuildingPosition(stop.location)
        return (
          <g key={stop.order}>
            <circle cx={p.x} cy={p.y} r={4.5} className="fill-card stroke-primary" strokeWidth={1.2} />
            <text x={p.x} y={p.y + 1.4} textAnchor="middle" className="fill-primary text-[5px] font-bold">
              {stop.order}
            </text>
            <text x={p.x} y={p.y + 9} textAnchor="middle" className="fill-foreground text-[3.6px] font-medium">
              {stop.location.building}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function EmptyNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <MapPin className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 font-display font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
