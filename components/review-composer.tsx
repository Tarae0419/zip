"use client"

import { useEffect, useState } from "react"
import { PenLine, Star, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { aiSuggestedTags, predefinedReviewTags } from "@/lib/mock-data"

export function ReviewComposer() {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [body, setBody] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // 모달 열림 시 배경 스크롤 방지 + ESC 닫기
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open])

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function handleSubmit() {
    // 실제 저장 로직은 없음 — 디자인 초안이므로 모달만 닫고 상태 초기화
    setOpen(false)
    setRating(0)
    setHoverRating(0)
    setBody("")
    setSelectedTags([])
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        <PenLine className="size-4" aria-hidden="true" />
        수강평 작성하기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="수강평 작성"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-6 shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">
                수강평 작성하기
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* 별점 */}
            <div className="mt-5">
              <p className="text-sm font-semibold text-foreground">별점</p>
              <div
                className="mt-2 flex items-center gap-1"
                onMouseLeave={() => setHoverRating(0)}
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = i + 1
                  const active = (hoverRating || rating) >= value
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value}점`}
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHoverRating(value)}
                      className="p-0.5"
                    >
                      <Star
                        className={cn(
                          "size-8 transition-colors",
                          active
                            ? "fill-chart-5 text-chart-5"
                            : "fill-muted text-muted-foreground/30",
                        )}
                      />
                    </button>
                  )
                })}
                {rating > 0 && (
                  <span className="ml-2 text-sm font-semibold text-foreground">
                    {rating}.0
                  </span>
                )}
              </div>
            </div>

            {/* 본문 */}
            <div className="mt-5">
              <label
                htmlFor="review-body"
                className="text-sm font-semibold text-foreground"
              >
                수강평
              </label>
              <textarea
                id="review-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="강의 난이도, 과제량, 시험 방식 등 후배들에게 도움이 될 이야기를 남겨주세요."
                className="mt-2 w-full resize-none rounded-xl border border-input bg-background p-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </div>

            {/* 사전 정의 해시태그 */}
            <div className="mt-5">
              <p className="text-sm font-semibold text-foreground">해시태그</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {predefinedReviewTags.map((tag) => {
                  const selected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent",
                      )}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* AI 추천 태그 */}
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                AI 추천 태그
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {aiSuggestedTags.map((tag) => {
                  const selected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-full border border-dashed px-3 py-1.5 text-sm font-medium transition",
                        selected
                          ? "border-muted-foreground bg-muted-foreground text-background"
                          : "border-border bg-muted text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-border bg-card py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
