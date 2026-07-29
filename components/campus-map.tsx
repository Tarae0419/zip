import { MapPin, Info } from "lucide-react"
import type { CartCourse, Weekday } from "@/lib/timetable/types"
import {
  buildCampusStops,
  estimateWalkMinutes,
  formatMinutes,
  getBuildingPosition,
  getSessionsForDay,
} from "@/lib/timetable/schedule"

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

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start gap-2 rounded-lg bg-accent/50 px-3 py-2 text-xs text-accent-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <p>
          실제 캠퍼스 배치와 다를 수 있는 예시(스케매틱) 지도예요. 이동 시간은 건물 좌표 거리 기반 추정치이며
          실제 도보 경로를 측정한 값이 아니에요.
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
    </div>
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
