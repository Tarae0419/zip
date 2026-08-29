"use client"

import { useId, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { AlertCircle, Loader2, PenLine, Sparkles, Star, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { predefinedReviewTags } from "@/lib/mock-data"
import { submitReview, suggestReviewHashtags } from "@/lib/actions/reviews"

const MIN_BODY_LENGTH_FOR_SUGGESTION = 10

export function ReviewComposer({ courseId }: { courseId: string }) {
  const router = useRouter()
  const errorId = useId()
  const firstRatingRef = useRef<HTMLButtonElement>(null)
  const [isPending, startTransition] = useTransition()
  const [isSuggesting, startSuggestTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [body, setBody] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([])
  const [hasSuggested, setHasSuggested] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function handleSuggestTags() {
    startSuggestTransition(async () => {
      const tags = await suggestReviewHashtags(body)
      setAiSuggestedTags(tags)
      setHasSuggested(true)
    })
  }

  function handleSubmit() {
    if (rating === 0) {
      setError("별점을 선택해주세요.")
      firstRatingRef.current?.focus()
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await submitReview({ courseId, rating, body, hashtags: selectedTags })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      setRating(0)
      setHoverRating(0)
      setBody("")
      setSelectedTags([])
      setAiSuggestedTags([])
      setHasSuggested(false)
      router.refresh()
    })
  }

  const ratingIsInvalid = error === "별점을 선택해주세요."

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setError(null)
        setOpen(nextOpen)
      }}
    >
      <Dialog.Trigger
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        <PenLine className="size-4" aria-hidden="true" />
        수강평 작성하기
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Popup className="max-h-[90svh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-card p-6 shadow-elevated outline-none sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <Dialog.Title className="font-display text-lg font-bold text-foreground">
                수강평 작성하기
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                별점, 수강평과 해시태그를 입력해 수강평을 등록하세요.
              </Dialog.Description>
              <Dialog.Close
                aria-label="닫기"
                className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:size-8"
              >
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* 별점 */}
            <div className="mt-5">
              <p className="text-sm font-semibold text-foreground">별점</p>
              <div
                role="group"
                aria-label="별점 선택"
                aria-describedby={ratingIsInvalid ? errorId : undefined}
                className="mt-2 flex items-center gap-1"
                onMouseLeave={() => setHoverRating(0)}
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = i + 1
                  const active = (hoverRating || rating) >= value
                  return (
                    <button
                      key={value}
                      ref={value === 1 ? firstRatingRef : undefined}
                      type="button"
                      aria-label={`${value}점`}
                      aria-pressed={rating === value}
                      onClick={() => {
                        setRating(value)
                        if (ratingIsInvalid) setError(null)
                      }}
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
                name="reviewBody"
                autoComplete="off"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="강의 난이도, 과제량, 시험 방식 등 후배들에게 도움이 될 이야기를 남겨주세요."
                className="mt-2 w-full resize-none rounded-xl border border-input bg-background p-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25 sm:text-sm"
              />
              <button
                type="button"
                onClick={handleSuggestTags}
                disabled={body.trim().length < MIN_BODY_LENGTH_FOR_SUGGESTION || isSuggesting}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSuggesting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden="true" />
                )}
                AI로 태그 추천받기
              </button>
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

            {/* AI 추천 태그 — "AI로 태그 추천받기"를 눌렀을 때만 채워진다 */}
            {hasSuggested && (
              <div className="mt-4" role="status" aria-live="polite">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  AI 추천 태그
                </p>
                {aiSuggestedTags.length > 0 ? (
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
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    본문과 뚜렷하게 관련된 태그를 찾지 못했어요.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div id={errorId} className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <Dialog.Close
                className="flex-1 rounded-full border border-border bg-card py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                취소
              </Dialog.Close>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSubmit}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isPending ? "등록 중…" : "등록"}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
