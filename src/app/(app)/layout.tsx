import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: userData } = await supabase
    .from("Users")
    .select("onboarding_complete, name")
    .eq("id", user.id)
    .single()

  if (userData && !userData.onboarding_complete) {
    redirect("/onboarding")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      {/* Animated ambient orbs */}
      <div className="bg-orb-a" aria-hidden="true" />
      <div className="bg-orb-b" aria-hidden="true" />
      <div className="bg-orb-c" aria-hidden="true" />

      <Sidebar />

      <div className="ml-14 flex flex-1 flex-col overflow-hidden relative z-10">
        <Header userEmail={user.email} userName={userData?.name ?? undefined} />
        <main className="flex-1 overflow-y-auto px-5 py-4 md:px-7 md:py-5">
          {children}
        </main>
      </div>
    </div>
  )
}
