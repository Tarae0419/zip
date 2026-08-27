"use client"

import { useMemo, useState, useSyncExternalStore, useTransition } from "react"
import { BookOpen, Loader2, Sparkles } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { generateStudyInsights } from "@/lib/actions/study"
import { hasEnoughStudyEvidence, sanitizeStudyHubData, STUDY_HUB_STORAGE_KEY } from "@/lib/study/storage"
import type { StudyCourseRecord, StudyHubData } from "@/lib/study/types"

const EMPTY_DATA: StudyHubData = { version: 1, records: [] }
const subscribeToClient = () => () => undefined

function readStudyHubData(): StudyHubData {
  if (typeof window === "undefined") return EMPTY_DATA

  try {
    const raw = window.localStorage.getItem(STUDY_HUB_STORAGE_KEY)
    return raw ? sanitizeStudyHubData(JSON.parse(raw)) ?? EMPTY_DATA : EMPTY_DATA
  } catch {
    window.localStorage.removeItem(STUDY_HUB_STORAGE_KEY)
    return EMPTY_DATA
  }
}

function emptyRecord(course: { id: string; name: string; semester: string }): StudyCourseRecord {
  return { courseId: course.id, courseName: course.name, semester: course.semester, objective: "", weeklyNotes: "", assignments: "", exams: "", careerKeyword: "", aiSummary: "", interviewQuestions: [], generatedAt: null, updatedAt: new Date().toISOString() }
}

export function StudyHub() {
  const { cart, mounted: cartMounted } = useCart()
  const [data, setData] = useState<StudyHubData>(readStudyHubData)
  const storageMounted = useSyncExternalStore(subscribeToClient, () => true, () => false)
  const [selectedKey, setSelectedKey] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const courses = useMemo(() => [...cart].sort((a, b) => b.semester.localeCompare(a.semester) || a.name.localeCompare(b.name, "ko")), [cart])
  const activeKey = selectedKey || (courses[0] ? `${courses[0].id}|${courses[0].semester}` : "")
  const activeCourse = courses.find((course) => `${course.id}|${course.semester}` === activeKey)
  const record = activeCourse ? data.records.find((item) => `${item.courseId}|${item.semester}` === activeKey) ?? emptyRecord(activeCourse) : null

  function persistRecord(next: StudyCourseRecord) {
    const exists = data.records.some((item) => item.courseId === next.courseId && item.semester === next.semester)
    const records = exists ? data.records.map((item) => item.courseId === next.courseId && item.semester === next.semester ? next : item) : [...data.records, next]
    const saved = { version: 1 as const, records }
    setData(saved)
    window.localStorage.setItem(STUDY_HUB_STORAGE_KEY, JSON.stringify(saved))
  }

  function update(field: keyof StudyCourseRecord, value: string) {
    if (!record) return
    persistRecord({ ...record, [field]: value, updatedAt: new Date().toISOString() })
  }

  function generate() {
    if (!record) return
    setMessage(null)
    if (!hasEnoughStudyEvidence(record)) return setMessage("강의 목표, 주차 메모, 과제 또는 시험 정보를 합해 40자 이상 입력해주세요.")
    startTransition(async () => {
      const result = await generateStudyInsights(record)
      if (!result.ok) return setMessage(result.error)
      persistRecord({ ...record, aiSummary: result.summary, interviewQuestions: result.questions, generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      setMessage("수업 요약과 면접 질문을 생성했어요.")
    })
  }

  if (!cartMounted || !storageMounted) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />
  if (courses.length === 0) return <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><BookOpen className="mx-auto size-8 text-primary" /><p className="mt-3 font-semibold text-foreground">시간표에 담긴 과목이 없어요</p><p className="mt-1 text-sm text-muted-foreground">내 시간표에서 과목을 먼저 담아주세요.</p></div>

  return <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
    <aside className="h-fit rounded-2xl border border-border bg-card p-3 lg:sticky lg:top-24">
      <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">내 수업</p>
      <div className="mt-1 space-y-1">{courses.map((course) => { const key = `${course.id}|${course.semester}`; return <button key={key} type="button" onClick={() => setSelectedKey(key)} className={`w-full rounded-xl px-3 py-2 text-left transition ${activeKey === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}><span className="block truncate text-sm font-semibold">{course.name}</span><span className={`text-xs ${activeKey === key ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{course.semester} · {course.professor}</span></button> })}</div>
    </aside>

    {record ? <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-display text-xl font-bold text-foreground">{record.courseName}</h2><p className="mt-1 text-sm text-muted-foreground">입력하는 내용은 이 브라우저에 자동 저장돼요.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><Area label="강의 목표·핵심 주제" value={record.objective} onChange={(value) => update("objective", value)} /><Area label="주차별 학습 메모" value={record.weeklyNotes} onChange={(value) => update("weeklyNotes", value)} /><Area label="과제·프로젝트" value={record.assignments} onChange={(value) => update("assignments", value)} /><Area label="시험 범위·평가 방식" value={record.exams} onChange={(value) => update("exams", value)} /></div>
        <label className="mt-4 block"><span className="mb-1.5 block text-sm font-semibold text-foreground">관심 직무 키워드</span><input value={record.careerKeyword} maxLength={100} onChange={(event) => update("careerKeyword", event.target.value)} placeholder="예: 백엔드 개발자" className="input" /></label>
        <button type="button" onClick={generate} disabled={isPending} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} AI 요약·면접 질문 생성</button>
        {message ? <p className="mt-3 text-sm text-muted-foreground" role="status">{message}</p> : null}
      </div>
      {record.aiSummary ? <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-display text-lg font-bold text-foreground">AI 수업 요약</h2><textarea value={record.aiSummary} onChange={(event) => update("aiSummary", event.target.value)} rows={6} className="mt-3 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm leading-relaxed text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25" /><p className="mt-2 text-xs text-muted-foreground">사용자 입력 자료만 근거로 생성했으며 직접 수정할 수 있어요.</p></div> : null}
      {record.interviewQuestions.length > 0 ? <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-display text-lg font-bold text-foreground">수업 연계 면접 질문</h2><div className="mt-4 space-y-3">{record.interviewQuestions.map((question, index) => <article key={`${question.question}-${index}`} className="rounded-xl border border-border bg-background p-4"><p className="font-semibold text-foreground">{index + 1}. {question.question}</p><p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">질문 의도:</strong> {question.intent}</p><p className="mt-1 text-sm text-muted-foreground"><strong className="text-foreground">답변 근거:</strong> {question.evidence}</p></article>)}</div></div> : null}
    </section> : null}
  </div>
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} maxLength={8000} className="w-full resize-y rounded-xl border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25" /></label>
}
