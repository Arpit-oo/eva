"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Sparkles,
  Calendar,
  BookOpen,
  FileStack,
  Settings,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/templates", label: "Templates", icon: FileStack },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r border-white/10 bg-card/80 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
        <div className="h-8 w-8 rounded-xl bg-primary/90 shadow-[0_0_24px_rgba(76,145,255,0.45)] flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <span className="block font-semibold text-lg tracking-tight leading-none">EVA</span>
          <span className="text-[11px] text-muted-foreground uppercase tracking-[0.18em]">Content OS</span>
        </div>
      </div>

      <div className="px-3 pt-4">
        <Link
          href="/settings"
          className="flex items-center justify-center rounded-xl bg-primary/90 px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_14px_24px_rgba(66,124,228,0.35)] transition hover:bg-primary"
        >
          Add Brand Identity
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1.5">
        <p className="px-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">Workspace</p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-primary/90 text-primary-foreground shadow-[0_10px_22px_rgba(68,126,230,0.4)]"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 pb-4 border-t border-white/10 pt-4">
        <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">Account</p>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all",
            pathname.startsWith("/settings")
              ? "bg-primary/90 text-primary-foreground shadow-[0_10px_22px_rgba(68,126,230,0.4)]"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          Settings
        </Link>
        <p className="px-2 pt-3 text-[11px] text-muted-foreground/70">EVA v1 MVP</p>
      </div>
    </aside>
  )
}
