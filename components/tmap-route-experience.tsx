"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { AlertTriangle, Info, Loader2, MapPin } from "lucide-react"

import type { CampusStop } from "@/lib/timetable/types"
import type {
  TmapWalkingLegRequest,
  TmapWalkingLegResult,
  TmapWalkingResponse,
} from "@/lib/timetable/tmap-contract"
import {
  estimateWalkMinutes,
  formatMinutes,
  getRealCoordinate,
} from "@/lib/timetable/schedule"

const TmapRouteMap = dynamic(
  () => import("@/components/tmap-route-map").then((module) => module.TmapRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square w-full items-center justify-center bg-muted/40 md:aspect-video" role="status">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">경로 지도를 준비하는 중…</span>
      </div>
    ),
  },
)

type RequestedLeg = TmapWalkingLegRequest & { toStopIndex: number }

type LoadState =
  | { status: "loading" }
  | { status: "success"; response: TmapWalkingResponse }
  | { status: "error"; httpStatus: number | null }

export function TmapRouteExperience({
  stops,
  requestJson,
  fallback,
}: {
  stops: CampusStop[]
  requestJson: string
  fallback: ReactNode
}) {
  const requestedLegs = JSON.parse(requestJson) as RequestedLeg[]
  const [state, setState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const legs = (JSON.parse(requestJson) as RequestedLeg[]).map(
      ({ fromBuildingKey, toBuildingKey }) => ({ fromBuildingKey, toBuildingKey }),
    )

    async function loadRoutes() {
      try {
        const response = await fetch("/api/tmap/walking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ legs }),
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok) {
          if (active) setState({ status: "error", httpStatus: response.status })
          return
        }
        const payload = await response.json()
        if (!isWalkingResponse(payload)) {
          if (active) setState({ status: "error", httpStatus: null })
          return
        }
        if (active) setState({ status: "success", response: payload })
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        if (active) setState({ status: "error", httpStatus: null })
      }
    }

    void loadRoutes()
    return () => {
      active = false
      controller.abort()
    }
  }, [requestJson])

  if (state.status === "loading") {
    return (
      <div aria-live="polite" aria-busy="true">
        <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-border bg-muted/40 md:aspect-video">
          <Loader2 className="mr-2 size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">TMAP 실제 보행 경로를 계산하는 중…</span>
        </div>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div>
        <RouteFailureNotice httpStatus={state.httpStatus} />
        {fallback}
      </div>
    )
  }

  const successfulLegs = state.response.legs.filter(
    (leg): leg is Extract<TmapWalkingLegResult, { status: "ok" }> => leg.status === "ok",
  )
  const sameLocationCount = state.response.legs.filter(
    (leg) => leg.status === "error" && leg.code === "SAME_LOCATION",
  ).length
  if (successfulLegs.length === 0 && sameLocationCount === 0) {
    return (
      <div>
        <RouteFailureNotice />
        {fallback}
      </div>
    )
  }

  const resultByStopIndex = new Map<number, TmapWalkingLegResult>()
  for (const result of state.response.legs) {
    const requested = requestedLegs[result.index]
    if (requested) resultByStopIndex.set(requested.toStopIndex, result)
  }
  const successfulStopIndexes = new Set<number>()
  for (const result of successfulLegs) {
    const requested = requestedLegs[result.index]
    if (!requested) continue
    successfulStopIndexes.add(requested.toStopIndex - 1)
    successfulStopIndexes.add(requested.toStopIndex)
  }
  const mapStops = stops.flatMap((stop, index) => {
    if (!successfulStopIndexes.has(index)) return []
    const coordinate = getRealCoordinate(stop.location)
    return coordinate ? [{ order: stop.order, building: stop.location.building, ...coordinate }] : []
  })
  const wholeDayComplete =
    successfulLegs.length + sameLocationCount === state.response.legs.length &&
    requestedLegs.length === Math.max(0, stops.length - 1)

  return (
    <div>
      {successfulLegs.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-secondary/30">
          <TmapRouteMap routes={successfulLegs.map((leg) => leg.route)} stops={mapStops} />
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
          연속 수업이 모두 같은 건물이라 별도 보행 경로가 필요하지 않아요.
        </p>
      )}

      <ol className="mt-4 space-y-2">
        {stops.map((stop, stopIndex) => {
          const previousStop = stops[stopIndex - 1]
          const offCampusJump = previousStop && previousStop.location.campus !== stop.location.campus
          const legResult = resultByStopIndex.get(stopIndex)

          return (
            <li key={stop.order}>
              {stopIndex > 0 && offCampusJump ? (
                <p className="pl-1 text-xs font-medium text-destructive">
                  ⚠ {previousStop.location.campus} 캠퍼스 → {stop.location.campus} 캠퍼스 이동 — 캠퍼스 간 도보
                  경로를 계산하지 않아요.
                </p>
              ) : null}
              {stopIndex > 0 && !offCampusJump ? (
                <RouteLegSummary
                  result={legResult}
                  previousStop={previousStop}
                  stop={stop}
                />
              ) : null}
              <StopCard stop={stop} />
            </li>
          )
        })}
      </ol>

      {!wholeDayComplete ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          일부 구간은 실제 경로 대신 예상 시간 또는 별도 안내로 표시했어요.
        </p>
      ) : null}
    </div>
  )
}

function RouteLegSummary({
  result,
  previousStop,
  stop,
}: {
  result: TmapWalkingLegResult | undefined
  previousStop: CampusStop
  stop: CampusStop
}) {
  if (result?.status === "error" && result.code === "SAME_LOCATION") {
    return (
      <p className="min-h-7 pl-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
        {orderLabel(previousStop.order)} → {orderLabel(stop.order)} · 도보 0분 (같은 위치)
      </p>
    )
  }

  if (result?.status === "ok") {
    return (
      <p className="min-h-7 pl-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
        {orderLabel(previousStop.order)} → {orderLabel(stop.order)} · 도보 {formatDuration(result.route.durationSeconds)}
      </p>
    )
  }

  return (
    <p className="min-h-7 pl-1 text-xs text-muted-foreground">
      {orderLabel(previousStop.order)} → {orderLabel(stop.order)} · 예상 도보 약{" "}
      {estimateWalkMinutes(previousStop.location, stop.location)}분
      {result?.status === "error" ? ` (${errorLabel(result.code)}, 직선거리 기반)` : " (직선거리 기반)"}
    </p>
  )
}

function StopCard({ stop }: { stop: CampusStop }) {
  return (
    <div className="mt-1 flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <span className="mt-0.5 font-bold text-primary">{orderLabel(stop.order)}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
          <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {stop.location.campus} · {stop.location.building} {stop.location.room}호
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {stop.sessions
            .map((session) => `${session.courseName} (${formatMinutes(session.startMinutes)}~${formatMinutes(session.endMinutes)})`)
            .join(", ")}
        </p>
      </div>
    </div>
  )
}

function RouteFailureNotice({ httpStatus }: { httpStatus?: number | null }) {
  const message =
    httpStatus === 429
      ? "TMAP 요청이 잠시 많아요. 잠시 후 다시 시도해주세요."
      : httpStatus === 401
        ? "로그인 세션을 확인한 뒤 다시 시도해주세요."
        : "TMAP 실제 경로를 불러오지 못해 추정 동선으로 전환했어요."

  return (
    <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100" role="status">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

function isWalkingResponse(value: unknown): value is TmapWalkingResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "provider" in value &&
      value.provider === "tmap" &&
      "legs" in value &&
      Array.isArray(value.legs),
  )
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0분"
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return `${minutes}분`
}

function errorLabel(code: Extract<TmapWalkingLegResult, { status: "error" }>["code"]): string {
  switch (code) {
    case "COORDINATE_UNVERIFIED":
      return "출입구 좌표 검수 중"
    case "UNKNOWN_BUILDING":
      return "등록된 건물 좌표 없음"
    case "UNSUPPORTED_CAMPUS":
      return "TMAP 검증 전 캠퍼스"
    case "SAME_LOCATION":
      return "같은 위치"
    case "PROVIDER_TIMEOUT":
      return "TMAP 응답 지연"
    case "PROVIDER_QUOTA":
      return "TMAP 사용 한도 도달"
    case "TMAP_NOT_CONFIGURED":
    case "PROVIDER_AUTH":
      return "TMAP 설정 확인 필요"
    case "NO_ROUTE":
      return "보행 경로 없음"
    default:
      return "TMAP 경로 실패"
  }
}

const ORDER_LABELS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]

function orderLabel(order: number): string {
  return ORDER_LABELS[order - 1] ?? `#${order}`
}
