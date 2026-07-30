import { Suspense } from "react"
import { SiteHeader } from "@/components/site-header"
import { getAnonId } from "@/lib/auth/anon-user"
import { getUserName } from "@/lib/db/queries"

export function AppHeader() {
  return (
    <Suspense
      fallback={
        <div className="sticky top-0 z-40 h-[65px] border-b border-border/80 bg-background/85 backdrop-blur-md" />
      }
    >
      <AppHeaderContent />
    </Suspense>
  )
}

async function AppHeaderContent() {
  const anonId = await getAnonId()
  const userName = await getUserName(anonId)
  return <SiteHeader userName={userName} />
}
