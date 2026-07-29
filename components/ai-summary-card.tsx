import { Sparkles } from "lucide-react"
import type { HashtagStat } from "@/lib/mock-data"

export function AiSummaryCard({
  summary,
  hashtags,
}: {
  summary: string
  hashtags: HashtagStat[]
}) {
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-6 md:p-7">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <h2 className="font-display text-lg font-bold text-foreground">
          AI가 이 강의를 이렇게 요약했어요
        </h2>
      </div>

      <p className="mt-4 text-pretty leading-relaxed text-foreground/90">
        {summary}
      </p>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-foreground">
          수강생들이 이렇게 언급했어요
        </p>
        <div className="space-y-3">
          {hashtags.map((h) => (
            <div key={h.tag} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-medium text-foreground">
                #{h.tag}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-card">
                <div
                  className="flex h-full items-center justify-end rounded-full bg-primary px-2 transition-all"
                  style={{ width: `${h.percent}%` }}
                >
                  <span className="text-xs font-semibold text-primary-foreground">
                    {h.percent}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
