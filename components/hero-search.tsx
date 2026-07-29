"use client"

import type React from "react"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Search } from "lucide-react"

export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" role="search">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="과목명 또는 관심 분야를 검색해보세요"
          aria-label="과목 검색"
          className="h-14 w-full rounded-full border border-input bg-card pl-13 pr-28 text-base text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/20"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          검색
        </button>
      </div>
    </form>
  )
}
