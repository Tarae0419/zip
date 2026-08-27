"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { CheckCircle2, Download, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createEmptyPortfolioItem, PORTFOLIO_STORAGE_KEY, sanitizePortfolioData } from "@/lib/portfolio/storage"
import type { PortfolioData, PortfolioItem, PortfolioItemCategory, PortfolioItemStatus } from "@/lib/portfolio/types"
import type { CurriculumPlanResult } from "@/lib/curriculum/types"

const EMPTY_DATA: PortfolioData = { version: 1, visibility: "private", items: [], updatedAt: "" }
const categories: PortfolioItemCategory[] = ["프로젝트", "자격증", "대외활동", "수업", "기타"]
const statuses: PortfolioItemStatus[] = ["계획", "진행 중", "완료"]
const subscribeToClient = () => () => undefined

function readPortfolioData(): PortfolioData {
  if (typeof window === "undefined") return EMPTY_DATA

  try {
    const raw = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)
    return raw ? sanitizePortfolioData(JSON.parse(raw)) ?? EMPTY_DATA : EMPTY_DATA
  } catch {
    window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY)
    return EMPTY_DATA
  }
}

export function PortfolioBuilder() {
  const [data, setData] = useState<PortfolioData>(readPortfolioData)
  const mounted = useSyncExternalStore(subscribeToClient, () => true, () => false)
  const [message, setMessage] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const completed = useMemo(() => data.items.filter((item) => item.status === "완료").length, [data.items])
  const completionRate = data.items.length === 0 ? 0 : Math.round((completed / data.items.length) * 100)

  function persist(next: PortfolioData, nextMessage = "포트폴리오를 저장했어요.") {
    const saved = { ...next, updatedAt: new Date().toISOString() }
    setData(saved)
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(saved))
    setMessage(nextMessage)
  }

  function addItem() {
    const item = createEmptyPortfolioItem()
    persist({ ...data, items: [item, ...data.items] }, "새 활동을 추가했어요.")
    setOpenId(item.id)
  }

  function importCurriculum() {
    try {
      const raw = window.localStorage.getItem("curriculum-plan-v2")
      if (!raw) return setMessage("먼저 커리큘럼 화면에서 추천 결과를 저장해주세요.")
      const saved = JSON.parse(raw) as { result?: CurriculumPlanResult }
      if (saved.result?.status !== "ok") return setMessage("가져올 수 있는 커리큘럼 활동이 없어요.")
      const existing = new Set(data.items.map((item) => `${item.grade}|${item.title}`))
      const imported: PortfolioItem[] = saved.result.capabilityActivities
        .filter((activity) => !existing.has(`${activity.grade}|${activity.title}`))
        .map((activity) => ({
          ...createEmptyPortfolioItem(activity.grade),
          title: activity.title,
          category: activity.category === "프로젝트" ? "프로젝트" : activity.category === "자격증" ? "자격증" : "대외활동",
          goal: activity.expectedCapability,
          reflection: activity.reason,
          source: "커리큘럼 가져오기",
        }))
      if (imported.length === 0) return setMessage("새로 가져올 활동이 없어요.")
      persist({ ...data, items: [...imported, ...data.items] }, `커리큘럼 활동 ${imported.length}개를 가져왔어요.`)
    } catch {
      setMessage("저장된 커리큘럼을 읽지 못했어요.")
    }
  }

  function updateItem(id: string, patch: Partial<PortfolioItem>) {
    persist({ ...data, items: data.items.map((item) => item.id === id ? { ...item, ...patch } : item) }, "변경사항을 저장했어요.")
  }

  function removeItem(id: string) {
    persist({ ...data, items: data.items.filter((item) => item.id !== id) }, "활동을 삭제했어요.")
    if (openId === id) setOpenId(null)
  }

  if (!mounted) return <div className="h-48 animate-pulse rounded-2xl bg-muted" aria-label="포트폴리오 불러오는 중" />

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">전체 진행률</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{completionRate}%</p>
            <p className="text-xs text-muted-foreground">완료 {completed}개 / 전체 {data.items.length}개</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={importCurriculum} className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10">
              <Download className="size-4" aria-hidden="true" /> 커리큘럼 가져오기
            </button>
            <button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              <Plus className="size-4" aria-hidden="true" /> 활동 추가
            </button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${completionRate}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <span>공개 범위</span>
            <select value={data.visibility} onChange={(event) => persist({ ...data, visibility: event.target.value === "link" ? "link" : "private" })} className="input w-auto">
              <option value="private">비공개</option>
              <option value="link">링크 공개 준비</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">현재 버전은 브라우저 저장이며 실제 공개 링크는 생성하지 않아요.</p>
        </div>
        {message ? <p className="mt-3 text-sm text-primary" role="status">{message}</p> : null}
      </section>

      {data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          아직 활동이 없어요. 커리큘럼에서 가져오거나 직접 추가해보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-card">
              <button type="button" onClick={() => setOpenId(openId === item.id ? null : item.id)} className="flex w-full items-center gap-3 p-4 text-left">
                <CheckCircle2 className={cn("size-5 shrink-0", item.status === "완료" ? "text-emerald-500" : "text-muted-foreground")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-bold text-foreground">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.grade}학년 · {item.category} · {item.status} · {item.source}</span>
                </span>
                <span className="text-xs font-medium text-primary">{openId === item.id ? "접기" : "편집"}</span>
              </button>
              {openId === item.id ? (
                <div className="grid gap-4 border-t border-border p-4 md:grid-cols-2">
                  <TextField label="활동명" value={item.title} maxLength={100} onChange={(value) => updateItem(item.id, { title: value })} />
                  <div className="grid grid-cols-3 gap-2">
                    <SelectField label="학년" value={String(item.grade)} options={["1", "2", "3", "4"]} onChange={(value) => updateItem(item.id, { grade: Number(value) })} />
                    <SelectField label="분류" value={item.category} options={categories} onChange={(value) => updateItem(item.id, { category: value as PortfolioItemCategory })} />
                    <SelectField label="상태" value={item.status} options={statuses} onChange={(value) => updateItem(item.id, { status: value as PortfolioItemStatus })} />
                  </div>
                  <TextArea label="목표" value={item.goal} onChange={(value) => updateItem(item.id, { goal: value })} />
                  <TextField label="기간" value={item.period} maxLength={100} placeholder="예: 2026.03~2026.06" onChange={(value) => updateItem(item.id, { period: value })} />
                  <TextArea label="역할" value={item.role} onChange={(value) => updateItem(item.id, { role: value })} />
                  <TextArea label="사용 기술" value={item.skills} onChange={(value) => updateItem(item.id, { skills: value })} />
                  <TextArea label="결과" value={item.result} onChange={(value) => updateItem(item.id, { result: value })} />
                  <TextField label="결과물 링크" value={item.link} maxLength={500} placeholder="https://" onChange={(value) => updateItem(item.id, { link: value })} />
                  <div className="md:col-span-2"><TextArea label="회고" value={item.reflection} rows={4} onChange={(value) => updateItem(item.id, { reflection: value })} /></div>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="button" onClick={() => removeItem(item.id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline">
                      <Trash2 className="size-4" aria-hidden="true" /> 활동 삭제
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function TextField({ label, value, onChange, maxLength, placeholder }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span><input value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="input" /></label>
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span><textarea value={value} rows={rows} maxLength={1000} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25" /></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="input px-2">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}
