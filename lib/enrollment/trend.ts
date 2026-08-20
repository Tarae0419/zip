export type EnrollmentTrendPoint = { semester: string; enrolledCount: number; capacity: number | null; sectionCount: number }

export function summarizeEnrollmentTrend(points: EnrollmentTrendPoint[]): string {
  if (points.length === 0) return "학기별 수강 인원 데이터가 아직 없어요."
  if (points.length === 1) return `${points[0].semester} 수강 인원은 ${points[0].enrolledCount}명이며, 한 학기 데이터만 있어 변화 추세는 판단하지 않았어요.`
  const first = points[0]; const last = points[points.length - 1]; const change = last.enrolledCount - first.enrolledCount
  const direction = change > 0 ? `${change}명 증가` : change < 0 ? `${Math.abs(change)}명 감소` : "변화 없음"
  const peak = points.reduce((best, point) => point.enrolledCount > best.enrolledCount ? point : best)
  return `${first.semester}부터 ${last.semester}까지 수강 인원은 ${direction}했어요. 가장 많은 학기는 ${peak.semester}의 ${peak.enrolledCount}명이에요. 개설 분반 수 등 외부 요인이 있을 수 있어 원인을 단정하지 않아요.`
}
