"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Moon, Sun, LogOut, Settings, User, Plus } from "lucide-react"

interface HeaderProps {
  userEmail?: string
  userName?: string
}

export default function Header({ userEmail, userName }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()

  const pageMeta: Record<string, { title: string; subtitle: string }> = {
    "/dashboard": { title: "Dashboard", subtitle: "Overview and quick actions" },
    "/generate": { title: "Generate", subtitle: "Strategy and AI content creation" },
    "/calendar": { title: "Calendar", subtitle: "Schedule and planning" },
    "/library": { title: "Library", subtitle: "Saved and generated posts" },
    "/templates": { title: "Templates", subtitle: "Reusable content blueprints" },
    "/settings": { title: "Settings", subtitle: "Brand identity and integrations" },
  }

  const resolvedPage = Object.keys(pageMeta).find((route) => pathname === route || pathname.startsWith(route + "/"))
  const currentMeta = pageMeta[resolvedPage ?? "/dashboard"]

  async function handleSignOut() {
    await supabase.auth.signOut()
    toast.success("Signed out")
    router.push("/login")
    router.refresh()
  }

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? "?"

  return (
    <header className="h-16 border-b border-white/10 bg-card/75 backdrop-blur-xl flex items-center justify-between px-6 gap-4">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/90">Workspace</p>
        <h1 className="text-base font-semibold truncate">{currentMeta.title}</h1>
        <p className="text-xs text-muted-foreground truncate">{currentMeta.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-xl hidden sm:inline-flex">
          <Link href="/settings">
            <Plus className="h-4 w-4" />
            New Brand Identity
          </Link>
        </Button>

      {/* Theme toggle */}
      <Button
        variant="secondary"
        size="icon"
        className="rounded-xl"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <Avatar className="h-9 w-9 cursor-pointer">
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
