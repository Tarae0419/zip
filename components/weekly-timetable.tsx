import { WEEKDAYS } from "@/lib/timetable/types"
import type { CartCourse } from "@/lib/timetable/types"
import { buildSessionsForCourse, formatMinutes } from "@/lib/timetable/schedule"
import { cn } from "@/lib/utils"

// 배경을 과목 색으로 꽉 채우는 대신 카드 배경으로 불투명하게 채우고, 과목 구분은 왼쪽 굵은 색
// 띠(accent)로만 준다 — 다크 모드 chart 색상이 회색조라 반투명 색상 배경 위에 텍스트를 얹으면
// 대비가 색상마다 들쭉날쭉해지는데, 불투명 카드 배경 + text-foreground 조합이면 항상 대비가 보장된다.
const CHART_ACCENTS = ["border-l-chart-1", "border-l-chart-2", "border-l-chart-3", "border-l-chart-4", "border-l-chart-5"]

const DEFAULT_START = 9 * 60
const DEFAULT_END = 18 * 60

export function WeeklyTimetable({
  cart,
  activeCourseId,
  onSessionClick,
}: {
  cart: CartCourse[]
  activeCourseId?: string | null
  onSessionClick?: (courseId: string) => void
}) {
  const accentByCourseId = new Map(cart.map((course, i) => [course.id, CHART_ACCENTS[i % CHART_ACCENTS.length]]))
  const allSessions = cart.flatMap((course) => buildSessionsForCourse(course))

  const minStart = Math.min(DEFAULT_START, ...allSessions.map((s) => s.startMinutes))
  const maxEnd = Math.max(DEFAULT_END, ...allSessions.map((s) => s.endMinutes))
  const rangeStart = Math.floor(minStart / 60) * 60
  const rangeEnd = Math.ceil(maxEnd / 60) * 60
  const totalMinutes = rangeEnd - rangeStart

  const hourMarks: number[] = []
  for (let h = rangeStart; h <= rangeEnd; h += 60) hourMarks.push(h)

  const rowHeightPx = 56

  return (
    <div className="scrollbar-hide overflow-x-auto rounded-2xl border border-border bg-card">
      <div className="flex min-w-[560px]">
        {/* 시간 라벨 열 */}
        <div className="w-14 shrink-0 border-r border-border">
          <div className="h-10 border-b border-border" />
          <div className="relative" style={{ height: (totalMinutes / 60) * rowHeightPx }}>
            {hourMarks.map((m) => (
              <div
                key={m}
                // 정각 선 위에 라벨이 정중앙(-translate-y-1/2)으로 겹치면 "09:00"의 "-"가 선과
                // 딱 맞아떨어져 헷갈린다는 피드백 — 선보다 살짝 아래로 내려서 선 바로 위 라벨처럼 보이게 한다.
                className="absolute right-2 -translate-y-1/4 text-xs text-muted-foreground"
                style={{ top: ((m - rangeStart) / totalMinutes) * 100 + "%" }}
              >
                {formatMinutes(m)}
              </div>
            ))}
          </div>
        </div>

        {WEEKDAYS.map((day) => {
          const daySessions = allSessions.filter((s) => s.day === day)
          return (
            <div key={day} className="flex-1 border-r border-border last:border-r-0">
              <div className="flex h-10 items-center justify-center border-b border-border text-sm font-semibold text-foreground">
                {day}
              </div>
              <div className="relative" style={{ height: (totalMinutes / 60) * rowHeightPx }}>
                {hourMarks.map((m) => (
                  <div
                    key={m}
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: ((m - rangeStart) / totalMinutes) * 100 + "%" }}
                  />
                ))}
                {daySessions.map((session, i) => {
                  const accent = accentByCourseId.get(session.courseId) ?? CHART_ACCENTS[0]
                  const top = ((session.startMinutes - rangeStart) / totalMinutes) * 100
                  const height = ((session.endMinutes - session.startMinutes) / totalMinutes) * 100
                  const isActive = activeCourseId === session.courseId
                  const sessionMinutes = session.endMinutes - session.startMinutes
                  // 2교시 이상 이어지는 블록 안에서도 정각 경계가 보이도록 내부에 얇은 구분선을 긋는다.
                  const innerHourMarks = hourMarks.filter((m) => m > session.startMinutes && m < session.endMinutes)
                  return (
                    <button
                      key={`${session.courseId}-${day}-${i}`}
                      type="button"
                      onClick={() => onSessionClick?.(session.courseId)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border border-border border-l-[3px] bg-card px-1.5 py-1 text-left leading-tight text-foreground shadow-sm transition",
                        accent,
                        onSessionClick && "cursor-pointer hover:brightness-95",
                        isActive && "ring-2 ring-primary ring-offset-1",
                      )}
                      style={{ top: `${top}%`, height: `${height}%` }}
                      title={`${session.courseName} · ${session.professor} · ${formatMinutes(session.startMinutes)}~${formatMinutes(session.endMinutes)}${session.location ? ` · ${session.location.building} ${session.location.room}` : ""}`}
                    >
                      {innerHourMarks.map((m) => (
                        <span
                          key={m}
                          aria-hidden="true"
                          className="absolute inset-x-0 border-t border-border/60"
                          style={{ top: `${((m - session.startMinutes) / sessionMinutes) * 100}%` }}
                        />
                      ))}
                      <p className="relative truncate text-sm font-bold">{session.courseName}</p>
                      {session.location && (
                        <p className="relative truncate text-[11px] text-muted-foreground">
                          {session.location.building} {session.location.room}호
                        </p>
                      )}
                      {session.professor && (
                        <p className="relative truncate text-[11px] text-muted-foreground">{session.professor}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
