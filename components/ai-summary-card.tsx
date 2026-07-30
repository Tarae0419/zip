import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { HashtagStat } from "@/lib/mock-data"

// predefinedReviewTags(lib/mock-data.ts) 안에서 긍정적으로 언급되는 경향이 있는 태그만 골랐다 —
// 나머지(과제많음/팀플많음/출석중요/시험어려움/재수강비추)는 상대적으로 부정적인 뉘앙스로 본다.
const POSITIVE_TAGS = new Set(["꿀강의", "널널함", "교수님친절", "실무중심"])

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
          {hashtags.map((h) => {
            const isPositive = POSITIVE_TAGS.has(h.tag)
            return (
              <div key={h.tag} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-28 shrink-0 text-sm font-medium",
                    isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400",
                  )}
                >
                  #{h.tag}
                </span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-card">
                  <div
                    className="animate-grow-bar flex h-full items-center justify-end rounded-full px-2 transition-[width]"
                    style={{
                      width: `${h.percent}%`,
                      backgroundColor: `color-mix(in oklch, var(--muted-foreground) ${100 - h.percent}%, var(--primary) ${h.percent}%)`,
                    }}
                  >
                    <span className="text-xs font-semibold text-primary-foreground">
                      {h.percent}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
