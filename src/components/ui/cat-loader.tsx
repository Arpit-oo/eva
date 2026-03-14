import { cn } from "@/lib/utils"

type CatLoaderProps = {
  overlay?: boolean
  className?: string
}

export function CatLoader({ overlay = false, className }: CatLoaderProps) {
  return (
    <div className={cn(overlay && "eva-cat-loader-overlay", className)}>
      <div className="eva-cat-loader-shell" role="status" aria-live="polite" aria-label="Loading">
        <h1 className="eva-cat-loader-intro">EVA loader go brr</h1>
        <div className="eva-cat-loader-box" aria-hidden="true">
          <div className="eva-cat-loader-cat">
            <div className="eva-cat-loader-body" />
            <div className="eva-cat-loader-body" />
            <div className="eva-cat-loader-tail" />
            <div className="eva-cat-loader-head" />
          </div>
        </div>
      </div>
    </div>
  )
}
