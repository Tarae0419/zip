import { Suspense } from "react"
import { SiteHeader } from "@/components/site-header"

export function AppHeader() {
  return (
    <Suspense
      fallback={
        <div className="sticky top-0 z-40 h-[65px] border-b border-border/80 bg-background/85 backdrop-blur-md" />
      }
    >
      <SiteHeader />
    </Suspense>
  )
}
