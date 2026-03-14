export function isLowPerformanceDevice(): boolean {
  if (typeof window === "undefined") return false

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  if (prefersReducedMotion) return true

  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean }
  }

  const saveData = nav.connection?.saveData === true
  if (saveData) return true

  const lowCpu = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4
  const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 4
  const smallTouchDevice = window.innerWidth < 768 && nav.maxTouchPoints > 0

  return lowCpu || lowMemory || smallTouchDevice
}
