export function formatTmapWalkDuration(seconds: number): string {
  if (seconds <= 0) return "0분"
  return `${Math.max(1, Math.ceil(seconds / 60))}분`
}
