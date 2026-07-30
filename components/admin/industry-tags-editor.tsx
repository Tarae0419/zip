"use client"

import { useState, useTransition } from "react"
import { X } from "lucide-react"
import { adminAddIndustryTag, adminRemoveIndustryTag } from "@/lib/actions/admin/courses"

export function IndustryTagsEditor({
  courseId,
  tags,
}: {
  courseId: string
  tags: { id: string; name: string; relevanceScore: number }[]
}) {
  const [newTag, setNewTag] = useState("")
  const [newScore, setNewScore] = useState("1")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAdd() {
    const name = newTag.trim()
    if (!name) return
    setError(null)
    startTransition(async () => {
      const result = await adminAddIndustryTag(courseId, name, Number(newScore))
      if (result.ok) setNewTag("")
      else setError(result.error)
    })
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      await adminRemoveIndustryTag(courseId, tagId)
    })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
            {t.name} · {t.relevanceScore.toFixed(2)}
            <button type="button" onClick={() => handleRemove(t.id)} disabled={isPending} aria-label={`${t.name} 제거`}>
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        {tags.length === 0 ? <span className="text-xs text-muted-foreground">아직 산업분야 태그가 없어요.</span> : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="산업분야명 (기존 이름과 같으면 그 태그에 연결)"
          className="h-8 w-64 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={newScore}
          onChange={(e) => setNewScore(e.target.value)}
          className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
        <button type="button" onClick={handleAdd} disabled={isPending} className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50">
          추가
        </button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </div>
  )
}
