import { Loader2 } from "lucide-react"

export default function AppLoading() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading workspace...</span>
      </div>
    </div>
  )
}
