"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const vantaRef = useRef<HTMLDivElement>(null)
  const vantaEffect = useRef<{ destroy: () => void } | null>(null)

  function initVanta() {
    if (
      vantaEffect.current ||
      !vantaRef.current ||
      typeof window === "undefined" ||
      !(window as unknown as Record<string, unknown>).VANTA
    ) {
      return
    }

    const VANTA = (window as unknown as Record<string, { TOPOLOGY: (opts: unknown) => { destroy: () => void } }>).VANTA
    vantaEffect.current = VANTA.TOPOLOGY({
      el: vantaRef.current,
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

    return true
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      initVanta()
    }, 250)

    window.setTimeout(() => {
      window.clearInterval(timer)
    }, 6000)

    return () => {
      window.clearInterval(timer)
      vantaEffect.current?.destroy()
      vantaEffect.current = null
    }
  }, [])

  return (
    <>
      <Script src="/vanta/p5.min.js" strategy="afterInteractive" onLoad={initVanta} />
      <Script
        src="/vanta/vanta.topology.min.js"
        strategy="afterInteractive"
        onLoad={initVanta}
      />

      <div ref={vantaRef} className="fixed inset-0 z-0 bg-[hsl(222,30%,9%)]" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-6">
        {children}
      </div>
    </>
  )
}
