"use client"

import type React from "react"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Compass, Search, Sparkles, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCart } from "@/components/cart-provider"

const navLinks = [
  { href: "/fields", label: "분야로 찾기", icon: Compass },
  { href: "/curriculum", label: "커리큘럼 설계", icon: Sparkles },
  { href: "/cart", label: "내 시간표", icon: CalendarDays },
]

export function SiteHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const { cart, mounted } = useCart()

  // 검색 결과 화면에서는 현재 검색어를 검색창에 반영
  useEffect(() => {
    if (pathname === "/search") {
      setQuery(searchParams.get("q") ?? "")
    }
  }, [pathname, searchParams])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="size-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            수강길잡이
          </span>
        </Link>

        <form
          onSubmit={handleSubmit}
          className="order-last w-full flex-1 md:order-none md:w-auto md:max-w-md"
          role="search"
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="과목명 또는 관심 분야를 검색해보세요"
              aria-label="과목 검색"
              className="h-10 w-full rounded-full border border-input bg-secondary/60 pl-9 pr-4 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/25"
            />
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-1 md:ml-0">
          {navLinks.map((link) => {
            const active = pathname === link.href
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{link.label}</span>
                {link.href === "/cart" && mounted && cart.length > 0 && (
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {cart.length}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
