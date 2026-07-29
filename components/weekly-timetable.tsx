import { WEEKDAYS } from "@/lib/timetable/types"
import type { CartCourse } from "@/lib/timetable/types"
import { buildSessionsForCourse, formatMinutes } from "@/lib/timetable/schedule"
import { cn } from "@/lib/utils"

const CHART_COLORS = [
  { bg: "bg-chart-1/15", border: "border-chart-1/40", text: "text-chart-1" },
  { bg: "bg-chart-2/15", border: "border-chart-2/40", text: "text-chart-2" },
  { bg: "bg-chart-3/15", border: "border-chart-3/40", text: "text-chart-3" },
  { bg: "bg-chart-4/15", border: "border-chart-4/40", text: "text-chart-4" },
  { bg: "bg-chart-5/15", border: "border-chart-5/40", text: "text-chart-5" },
]

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
  const colorByCourseId = new Map(cart.map((course, i) => [course.id, CHART_COLORS[i % CHART_COLORS.length]]))
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
                className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground"
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
                  const color = colorByCourseId.get(session.courseId) ?? CHART_COLORS[0]
                  const top = ((session.startMinutes - rangeStart) / totalMinutes) * 100
                  const height = ((session.endMinutes - session.startMinutes) / totalMinutes) * 100
                  const isActive = activeCourseId === session.courseId
                  return (
                    <button
                      key={`${session.courseId}-${day}-${i}`}
                      type="button"
                      onClick={() => onSessionClick?.(session.courseId)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition",
                        color.bg,
                        color.border,
                        color.text,
                        onSessionClick && "cursor-pointer hover:brightness-95",
                        isActive && "ring-2 ring-primary ring-offset-1",
                      )}
                      style={{ top: `${top}%`, height: `${height}%` }}
                      title={`${session.courseName} · ${formatMinutes(session.startMinutes)}~${formatMinutes(session.endMinutes)}${session.location ? ` · ${session.location.building} ${session.location.room}` : ""}`}
                    >
                      <p className="truncate font-semibold">{session.courseName}</p>
                      {session.location && <p className="truncate opacity-80">{session.location.building}</p>}
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
