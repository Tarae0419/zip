import { AppHeader } from "@/components/app-header"

export default function CartLoading() {
  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-muted" />
        <div className="mt-8 space-y-4">
          <div className="h-14 animate-pulse rounded-2xl bg-muted" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      </main>
    </div>
  )
}
