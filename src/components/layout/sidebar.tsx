"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Sparkles,
  Calendar,
  BookOpen,
  NotebookText,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import catboxLogo from "../../../iconn/catbox.jpg"
import guitarCatAvatar from "../../../iconn/guitarcat.jpg"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/templates", label: "Templates", icon: NotebookText },
]

function NavItem({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={href.replace("/", "") || "home"}
      className="flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors hover:bg-white/[0.06]"
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-all",
          active ? "bg-[#3b82f6] text-white shadow-[0_0_18px_rgba(59,130,246,0.45)]" : "text-slate-400"
        )}
      >
        {children}
      </span>
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-14 flex-col bg-[#0f1729] px-[6px] py-3">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3b82f6]/15">
          <Image
            src={catboxLogo}
            alt="EVA brand mark"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-cover"
            priority
          />
        </div>
      </div>

      <nav className="flex flex-1 flex-col items-center justify-center gap-2" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <NavItem key={href} href={href} active={active}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </NavItem>
            )
          })}
      </nav>

      <div className="flex flex-col items-center gap-3">
        <NavItem href="/settings" active={pathname.startsWith("/settings")}>
          <Settings className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Settings</span>
        </NavItem>

        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#6366f1]/20 ring-1 ring-[#6366f1]/35 hover:bg-[#6366f1]/30 transition-colors">
          <Image
            src={guitarCatAvatar}
            alt="User avatar"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
        </div>
      </div>
    </aside>
  )
}
