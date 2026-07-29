import { Suspense } from "react"
import { AppHeader } from "@/components/app-header"
import { SearchResults } from "@/components/search-results"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; credit?: string; grade?: string; requirement?: string }>
}) {
  const resolvedSearchParams = await searchParams

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main>
        <Suspense
          fallback={
            <div className="mx-auto max-w-6xl px-4 py-8 text-muted-foreground md:px-6">
              검색 결과를 불러오는 중...
            </div>
          }
        >
          <SearchResults searchParams={resolvedSearchParams} />
        </Suspense>
      </main>
    </div>
  )
}
