import { AppHeader } from "@/components/app-header"
import { StudyHub } from "@/components/study-hub"

export const metadata = { title: "수업 허브 — 수강길잡이", description: "시간표 과목의 학습 기록과 면접 질문을 관리하세요." }

export default function StudyPage() {
  return <div className="min-h-svh"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-10 md:px-6"><h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">수업 허브</h1><p className="mt-2 max-w-2xl text-muted-foreground">시간표에 담은 수업의 목표와 학습 기록을 정리하고, 입력한 내용에 근거한 AI 요약과 면접 질문을 만들어보세요.</p><div className="mt-8"><StudyHub /></div></main></div>
}
