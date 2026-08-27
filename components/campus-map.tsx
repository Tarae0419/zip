"use client"

import { Info, MapPin } from "lucide-react"

import {
  TmapRouteExperience,
  TmapSingleStopExperience,
} from "@/components/tmap-route-experience"
import {
  buildCampusStops,
  estimateWalkMinutes,
  formatMinutes,
  getBuildingPosition,
  getRealCoordinate,
  getSessionsForDay,
} from "@/lib/timetable/schedule"
import { getTmapBuildingKey, MAX_TMAP_WALKING_LEGS } from "@/lib/timetable/tmap-contract"
import type { CampusStop, CartCourse, Weekday } from "@/lib/timetable/types"

const ORDER_LABELS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]

function orderLabel(order: number): string {
  return ORDER_LABELS[order - 1] ?? `#${order}`
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
  const unlocatedCourseNames = [...new Set(sessions.filter((session) => !session.location).map((session) => session.courseName))]

  if (stops.length === 0) {
    return (
      <EmptyNotice
        title="강의실 정보가 없어 지도를 표시할 수 없어요"
        description={`${unlocatedCourseNames.join(", ")} 과목에 강의실 정보가 없어요.`}
      />
    )
  }

  const primaryCampus = stops[0].location.campus
  const schematicStops = stops.filter((stop) => stop.location.campus === primaryCampus)
  const missingCoordBuildings = [
    ...new Set(stops.filter((stop) => !getRealCoordinate(stop.location)).map((stop) => stop.location.building)),
  ]
  const requestedLegs = stops
    .slice(1)
    .flatMap((stop, index) => {
      const previousStop = stops[index]
      if (previousStop.location.campus !== stop.location.campus) return []
      return [
        {
          fromBuildingKey: getTmapBuildingKey(previousStop.location),
          toBuildingKey: getTmapBuildingKey(stop.location),
          toStopIndex: index + 1,
        },
      ]
    })
    .slice(0, MAX_TMAP_WALKING_LEGS)
  const requestJson = JSON.stringify(requestedLegs)
  const fallbackExperience = (
    <TmapOnlyFallback stops={stops} schematicStops={schematicStops} />
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start gap-2 rounded-lg bg-accent/50 px-3 py-2 text-xs text-accent-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <p>
          이동동선은 TMAP 실제 보행 경로만 사용해요. 경로를 계산할 수 없을 때도 다른 지도 서비스로 전환하지 않고
          추정값과 건물 순서만 분리해 표시해요.
        </p>
      </div>

      {stops.length === 1 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          이동이 없는 날이에요 — 하루 종일{" "}
          <span className="font-semibold text-foreground">{stops[0].location.building}</span>에서 수업이 있어요.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          이 날은 건물을 {stops.length}곳 이동해요. 아래에서 ①→②→③ 순서로 확인해보세요.
        </p>
      )}

      <div className="mt-4">
        {stops.length === 1 ? (
          <TmapSingleStopExperience stop={stops[0]} fallback={fallbackExperience} />
        ) : requestedLegs.length > 0 ? (
          <TmapRouteExperience
            key={`${day}:${requestJson}`}
            stops={stops}
            requestJson={requestJson}
            fallback={fallbackExperience}
          />
        ) : (
          fallbackExperience
        )}
      </div>

      {unlocatedCourseNames.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          강의실 정보가 없어 표시하지 못한 과목: {unlocatedCourseNames.join(", ")}
        </p>
      ) : null}
      {missingCoordBuildings.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          TMAP 좌표가 없어 실제 경로를 계산하지 못한 건물: {missingCoordBuildings.join(", ")}
        </p>
      ) : null}
    </div>
  )
}

function TmapOnlyFallback({
  stops,
  schematicStops,
}: {
  stops: CampusStop[]
  schematicStops: CampusStop[]
}) {
  return (
    <>
      <p className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground" role="status">
        TMAP 실제 경로를 표시할 수 없어 등록된 건물 순서와 직선거리 기반 추정만 보여줘요.
      </p>
      {stops.length !== schematicStops.length ? (
        <p className="mb-3 text-xs font-medium text-destructive">
          여러 캠퍼스가 포함되어 순서 안내에는 첫 캠퍼스({schematicStops[0]?.location.campus}) 건물만 표시해요.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-secondary/30">
        <SchematicStops stops={schematicStops} />
      </div>
      <StopList stops={stops} />
    </>
  )
}

function StopList({ stops }: { stops: CampusStop[] }) {
  return (
    <ol className="mt-4 space-y-2">
      {stops.map((stop, index) => {
        const previousStop = stops[index - 1]
        const offCampusJump = previousStop && previousStop.location.campus !== stop.location.campus
        const sameBuilding =
          previousStop &&
          !offCampusJump &&
          previousStop.location.building === stop.location.building

        return (
          <li key={stop.order}>
            {sameBuilding ? (
              <p className="min-h-7 pl-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                같은 건물 · 별도 이동 없음
              </p>
            ) : null}
            {index > 0 && !offCampusJump && !sameBuilding ? (
              <p className="min-h-7 pl-1 text-xs text-muted-foreground">
                도보 이동 약 {estimateWalkMinutes(previousStop.location, stop.location)}분 (직선거리 기반 추정 · TMAP
                실경로 없음)
              </p>
            ) : null}
            {offCampusJump ? (
              <p className="pl-1 text-xs font-medium text-destructive">
                ⚠ {previousStop.location.campus} 캠퍼스 → {stop.location.campus} 캠퍼스 이동 — 캠퍼스 간 도보
                이동시간을 추정하지 않아요.
              </p>
            ) : null}
            <StopCard stop={stop} />
          </li>
        )
      })}
    </ol>
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
            .map(
              (session) =>
                `${session.courseName} (${formatMinutes(session.startMinutes)}~${formatMinutes(session.endMinutes)})`,
            )
            .join(", ")}
        </p>
      </div>
    </div>
  )
}

function SchematicStops({ stops }: { stops: CampusStop[] }) {
  return (
    <svg viewBox="0 0 100 100" className="aspect-square w-full md:aspect-video" aria-hidden="true">
      {stops.map((stop) => {
        const position = getBuildingPosition(stop.location)
        return (
          <g key={stop.order}>
            <circle
              cx={position.x}
              cy={position.y}
              r={4.5}
              className="fill-card stroke-primary"
              strokeWidth={1.2}
            />
            <text
              x={position.x}
              y={position.y + 1.4}
              textAnchor="middle"
              className="fill-primary text-[5px] font-bold"
            >
              {stop.order}
            </text>
            <text
              x={position.x}
              y={position.y + 9}
              textAnchor="middle"
              className="fill-foreground text-[3.6px] font-medium"
            >
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
