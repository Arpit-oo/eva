import { CatLoader } from "@/components/ui/cat-loader"

export default function AppLoading() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center">
      <CatLoader />
    </div>
  )
}
