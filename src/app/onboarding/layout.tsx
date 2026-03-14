"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { isLowPerformanceDevice } from "@/lib/performance"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const vantaRef = useRef<HTMLDivElement>(null)
  const vantaEffect = useRef<{ destroy: () => void } | null>(null)
  const [reducedEffects, setReducedEffects] = useState(true)

  function initVanta() {
    const win = window as unknown as {
      p5?: unknown
      VANTA?: { TOPOLOGY?: (opts: unknown) => { destroy: () => void } }
    }

    if (
      vantaEffect.current ||
      !vantaRef.current ||
      typeof window === "undefined" ||
      !win.p5 ||
      !win.VANTA ||
      typeof win.VANTA.TOPOLOGY !== "function"
    ) {
      return
    }

    try {
      vantaEffect.current = win.VANTA.TOPOLOGY({
        el: vantaRef.current,
        p5: win.p5,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x3a7bd5,
        backgroundColor: 0x0d1220,
      })
    } catch {
      return
    }

    return true
  }

  useEffect(() => {
    if (isLowPerformanceDevice()) {
      setReducedEffects(true)
      return
    }

    setReducedEffects(false)

    const timer = window.setInterval(() => {
      initVanta()
    }, 250)

    window.setTimeout(() => {
      window.clearInterval(timer)
    }, 15000)

    return () => {
      window.clearInterval(timer)
      vantaEffect.current?.destroy()
      vantaEffect.current = null
    }
  }, [])

  return (
    <>
      {!reducedEffects && (
        <>
          <Script src="/vanta/p5.min.js" strategy="afterInteractive" onLoad={initVanta} />
          <Script
            src="/vanta/vanta.topology.min.js"
            strategy="afterInteractive"
            onLoad={initVanta}
          />
        </>
      )}

      <div
        ref={vantaRef}
        className="fixed inset-0 z-0 bg-[hsl(222,30%,9%)]"
        style={
          reducedEffects
            ? {
                background:
                  "radial-gradient(circle at 18% 18%, rgba(58,123,213,0.2), transparent 46%), radial-gradient(circle at 84% 72%, rgba(99,102,241,0.18), transparent 50%), #0d1220",
              }
            : undefined
        }
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-6">
        {children}
      </div>
    </>
  )
}
