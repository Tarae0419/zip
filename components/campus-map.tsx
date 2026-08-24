"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Script from "next/script"
import { Footprints, Info, MapPin, Smartphone } from "lucide-react"
import type { CampusStop, CartCourse, Weekday } from "@/lib/timetable/types"
import {
  MAX_NAVER_WALKING_POINTS,
  buildNaverWalkingUrl,
  type NaverWalkingPoint,
} from "@/lib/timetable/naver-walking"
import {
  buildCampusStops,
  estimateWalkMinutes,
  formatMinutes,
  getBuildingPosition,
  getRealCoordinate,
  getSessionsForDay,
} from "@/lib/timetable/schedule"

const ORDER_LABELS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]
const NAVER_MAP_KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY

function orderLabel(order: number): string {
  return ORDER_LABELS[order - 1] ?? `#${order}`
}

// 지도 SDK는 공식 타입 패키지를 설치하지 않고 이 컴포넌트 경계에서만 다룬다.
declare global {
  interface Window {
    kakao?: any
    naver?: any
    navermap_authFailure?: () => void
  }
}

export function CampusMap({ day, cart }: { day: Weekday; cart: CartCourse[] }) {
  const [naverMapFailed, setNaverMapFailed] = useState(false)
  const [kakaoMapFailed, setKakaoMapFailed] = useState(false)
  const handleNaverMapFailure = useCallback(() => setNaverMapFailed(true), [])
  const handleKakaoMapFailure = useCallback(() => setKakaoMapFailed(true), [])
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
  const mapProvider =
    geoStops.length === 0
      ? "schematic"
      : NAVER_MAP_KEY_ID && !naverMapFailed
        ? "naver"
        : KAKAO_JS_KEY && !kakaoMapFailed
          ? "kakao"
          : "schematic"
  const useRealMap = mapProvider !== "schematic"
  const fullDayRoutePoints: NaverWalkingPoint[] = geoStops.map(({ stop, coord }) => ({
    ...coord,
    name: `${stop.location.campus} ${stop.location.building}`,
  }))
  const canOpenFullDayRoute =
    stops.length === mapStops.length &&
    mapStops.length === geoStops.length &&
    fullDayRoutePoints.length >= 2 &&
    fullDayRoutePoints.length <= MAX_NAVER_WALKING_POINTS

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start gap-2 rounded-lg bg-accent/50 px-3 py-2 text-xs text-accent-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <p>
          {useRealMap
            ? `${mapProvider === "naver" ? "네이버" : "카카오"} 지도에는 건물 위치만 표시해요. 시간은 직선거리 추정치이며, 실제 경로는 네이버 지도의 도보 길찾기에서 확인해요.`
            : "실제 캠퍼스 배치와 다를 수 있는 예시 지도예요. 시간은 건물 좌표 거리 기반 추정치이며, 실제 경로는 네이버 지도의 도보 길찾기에서 확인해요."}
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

      {canOpenFullDayRoute && (
        <div className="mt-3">
          <NaverWalkingAction points={fullDayRoutePoints} label="하루 동선 도보 길찾기" showDesktopHint />
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-secondary/30">
        {mapProvider === "naver" ? (
          <NaverCampusMap geoStops={geoStops} onFailure={handleNaverMapFailure} />
        ) : mapProvider === "kakao" ? (
          <KakaoCampusMap geoStops={geoStops} onFailure={handleKakaoMapFailure} />
        ) : (
          <SchematicMap mapStops={mapStops} />
        )}
      </div>

      <ol className="mt-4 space-y-2">
        {stops.map((stop, i) => {
          const prevStop = stops[i - 1]
          const offCampusJump = prevStop && prevStop.location.campus !== stop.location.campus
          const prevCoord = prevStop ? getRealCoordinate(prevStop.location) : null
          const currentCoord = getRealCoordinate(stop.location)
          const legRoutePoints: NaverWalkingPoint[] | null =
            prevStop && !offCampusJump && prevCoord && currentCoord
              ? [
                  { ...prevCoord, name: `${prevStop.location.campus} ${prevStop.location.building}` },
                  { ...currentCoord, name: `${stop.location.campus} ${stop.location.building}` },
                ]
              : null
          return (
            <li key={stop.order}>
              {i > 0 && !offCampusJump && (
                <div className="flex min-h-7 flex-wrap items-center justify-between gap-2 pl-1">
                  <p className="text-xs text-muted-foreground">
                    도보 이동 약 {estimateWalkMinutes(prevStop.location, stop.location)}분 (직선거리 추정)
                  </p>
                  {legRoutePoints && <NaverWalkingAction points={legRoutePoints} label="실제 도보 길찾기" compact />}
                </div>
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
      {missingCoordBuildings.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          정확한 좌표를 찾지 못해 지도 핀으로는 안 뜨는 건물(목록에는 포함): {missingCoordBuildings.join(", ")}
        </p>
      )}
    </div>
  )
}

/** 네이버 동적 지도에는 정류지 핀만 표시한다. 실제 보행 경로는 지도 앱에서 계산한다. */
function NaverCampusMap({
  geoStops,
  onFailure,
}: {
  geoStops: { stop: CampusStop; coord: { lat: number; lng: number } }[]
  onFailure: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [sdkReady, setSdkReady] = useState(false)

  function loadSdk() {
    if (window.naver?.maps) setSdkReady(true)
  }

  function handleScriptReady() {
    if (!window.naver?.maps) {
      onFailure()
      return
    }
    setSdkReady(true)
  }

  useEffect(() => {
    const previousAuthFailure = window.navermap_authFailure
    window.navermap_authFailure = onFailure
    loadSdk()

    return () => {
      window.navermap_authFailure = previousAuthFailure
    }
  }, [onFailure])

  useEffect(() => {
    if (!sdkReady || !containerRef.current || geoStops.length === 0) return
    const naver = window.naver

    if (!mapRef.current) {
      mapRef.current = new naver.maps.Map(containerRef.current, {
        center: new naver.maps.LatLng(geoStops[0].coord.lat, geoStops[0].coord.lng),
        zoom: 16,
      })
    }
    const map = mapRef.current

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    const firstPosition = new naver.maps.LatLng(geoStops[0].coord.lat, geoStops[0].coord.lng)
    const bounds = new naver.maps.LatLngBounds(firstPosition, firstPosition)

    for (const { stop, coord } of geoStops) {
      const position = new naver.maps.LatLng(coord.lat, coord.lng)
      bounds.extend(position)

      const marker = new naver.maps.Marker({
        map,
        position,
        title: `${stop.location.building} ${stop.location.room}호`,
        icon: {
          content: `<span style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;border:2px solid #6d28d9;border-radius:50%;background:#fff;color:#6d28d9;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.22)">${stop.order}</span>`,
          anchor: new naver.maps.Point(14, 14),
        },
      })
      markersRef.current.push(marker)
    }

    if (geoStops.length === 1) map.setCenter(firstPosition)
    else map.fitBounds(bounds)

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
    }
  }, [sdkReady, geoStops])

  return (
    <>
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_KEY_ID}`}
        strategy="afterInteractive"
        onLoad={handleScriptReady}
        onReady={handleScriptReady}
        onError={onFailure}
      />
      <div ref={containerRef} className="aspect-square w-full md:aspect-video" />
    </>
  )
}

/** 기존 카카오 지도 키를 사용하는 폴백. 정류지 핀만 표시한다. */
function KakaoCampusMap({
  geoStops,
  onFailure,
}: {
  geoStops: { stop: CampusStop; coord: { lat: number; lng: number } }[]
  onFailure: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const [sdkReady, setSdkReady] = useState(false)
  const sdkReadyRef = useRef(false)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function loadSdk(failIfUnavailable = false) {
    if (!window.kakao?.maps) {
      if (failIfUnavailable) onFailure()
      return
    }
    window.kakao.maps.load(() => {
      sdkReadyRef.current = true
      setSdkReady(true)
    })
    if (failIfUnavailable) {
      loadTimeoutRef.current = setTimeout(() => {
        if (!sdkReadyRef.current) onFailure()
      }, 3000)
    }
  }

  // next/script의 onLoad는 이 스크립트를 "처음" 로드한 컴포넌트 인스턴스에서만 불릴 수 있어
  // (다른 화면에서 먼저 로드해둔 경우 등) mount 시점에 이미 로드돼 있는지도 직접 확인한다.
  useEffect(() => {
    loadSdk()
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    }
  }, [onFailure])

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
    for (const { stop, coord } of geoStops) {
      const position = new kakao.maps.LatLng(coord.lat, coord.lng)
      bounds.extend(position)

      const content = document.createElement("div")
      content.className =
        "flex size-7 items-center justify-center rounded-full border-2 border-primary bg-card text-xs font-bold text-primary shadow-md"
      content.textContent = String(stop.order)
      const overlay = new kakao.maps.CustomOverlay({ position, content, yAnchor: 0.5 })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)
    }

    map.setBounds(bounds)
  }, [sdkReady, geoStops])

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => loadSdk(true)}
        onReady={() => loadSdk(true)}
        onError={onFailure}
      />
      <div ref={containerRef} className="aspect-square w-full md:aspect-video" />
    </>
  )
}

function NaverWalkingAction({
  points,
  label,
  compact = false,
  showDesktopHint = false,
}: {
  points: NaverWalkingPoint[]
  label: string
  compact?: boolean
  showDesktopHint?: boolean
}) {
  const [href, setHref] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    setHref(buildNaverWalkingUrl(points, window.location.origin, navigator.userAgent))
  }, [points])

  if (href === undefined) return null

  if (!href) {
    if (!showDesktopHint) return null
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Smartphone className="size-3.5 shrink-0" aria-hidden="true" />
        실제 도보 길찾기는 모바일에서 이 시간표를 열면 사용할 수 있어요.
      </p>
    )
  }

  return (
    <a
      href={href}
      className={
        compact
          ? "inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-muted"
          : "inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      }
      title="네이버 지도 앱에서 실제 도보 경로 열기"
    >
      <Footprints className={compact ? "size-3.5" : "size-4"} aria-hidden="true" />
      {label}
    </a>
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
