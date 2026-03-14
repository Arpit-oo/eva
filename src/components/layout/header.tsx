"use client"

import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User, Search, Bell, Sun, Moon } from "lucide-react"

interface HeaderProps {
  userEmail?: string
  userName?: string
}

const PAGE_META: Record<string, { greeting?: boolean; title: string; subtitle: string }> = {
  "/dashboard": { greeting: true, title: "Dashboard", subtitle: "Overview and quick actions" },
  "/generate": { title: "Generate", subtitle: "Strategy and AI content creation" },
  "/calendar": { title: "Calendar", subtitle: "Schedule and planning" },
  "/library": { title: "Library", subtitle: "Saved and generated posts" },
  "/templates": { title: "Templates", subtitle: "Reusable content blueprints" },
  "/settings": { title: "Settings", subtitle: "Brand identity and integrations" },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export default function Header({ userEmail, userName }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const supabase = createClient()
  const [searchValue, setSearchValue] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const resolvedRoute =
    Object.keys(PAGE_META).find((r) => pathname === r || pathname.startsWith(r + "/")) ??
    "/dashboard"
  const meta = PAGE_META[resolvedRoute]

  const displayName = userName ?? userEmail?.split("@")[0] ?? "there"

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? "?"

  async function handleSignOut() {
    await supabase.auth.signOut()
    toast.success("Signed out")
    router.push("/login")
    router.refresh()
  }

  function handleThemeToggle() {
    setTheme(resolvedTheme === "light" ? "dark" : "light")
  }

  return (
    <header
      className="h-[60px] backdrop-blur-xl flex items-center justify-between px-5 gap-4 relative z-10"
      style={{
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--header-border)",
      }}
    >

      {/* Left — greeting or page title */}
      <div className="min-w-0 flex flex-col justify-center">
        {meta.greeting ? (
          <>
            <h1 className="text-[22px] font-medium leading-tight text-foreground">
              {getGreeting()}, {displayName}
            </h1>
            <p className="text-[14px] text-muted-foreground mt-0.5 leading-tight">
              Here&apos;s your content at a glance.
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 leading-none">
              {meta.subtitle}
            </p>
            <h1 className="text-sm font-semibold truncate mt-0.5 leading-tight">
              {meta.title}
            </h1>
          </>
        )}
      </div>

      {/* Right — search + bell + avatar */}
      <div className="flex items-center gap-2.5">

        {/* Search */}
        <div className="relative hidden sm:flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search posts, ideas…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="h-8 w-44 rounded-full border border-white/10 bg-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[rgba(99,102,241,0.4)] focus:bg-muted/80 transition-all duration-200"
          />
        </div>

        {/* Bell */}
        <button className="h-8 w-8 flex items-center justify-center rounded-full border border-white/10 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors">
          <Bell className="h-3.5 w-3.5" />
        </button>

        <button
          aria-label={resolvedTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          onClick={handleThemeToggle}
          className="h-8 w-8 flex items-center justify-center rounded-full border transition-colors"
          style={{
            background: resolvedTheme === "light" ? "rgba(99,130,210,0.12)" : "rgba(255,255,255,0.06)",
            borderColor: resolvedTheme === "light" ? "rgba(99,130,210,0.2)" : "rgba(255,255,255,0.1)",
            color: "var(--text-primary-color)",
          }}
        >
          {!mounted ? (
            <Moon className="h-3.5 w-3.5" />
          ) : resolvedTheme === "light" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              {userName && <p className="text-sm font-medium">{userName}</p>}
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings#profile")}>
              <User className="mr-2 h-4 w-4" />
              Brand Profiles
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
