import { AppHeader } from "@/components/app-header"
import { CartTimetableView } from "@/components/cart-timetable-view"

export const metadata = {
  title: "내 시간표 — 수강길잡이",
  description: "장바구니에 담은 강의의 주간 시간표와 요일별 강의실 이동동선을 확인하세요.",
}

export default function CartPage() {
  return (
    <div className="min-h-svh">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">내 시간표</h1>
        <p className="mt-1 text-muted-foreground">
          담은 강의의 시간표와, 요일별로 이동해야 하는 강의실 동선을 지도로 확인해보세요.
        </p>

        <div className="mt-8">
          <CartTimetableView />
        </div>
      </main>
    </div>
  )
}
