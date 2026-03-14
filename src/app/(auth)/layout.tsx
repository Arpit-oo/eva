"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const vantaRef = useRef<HTMLDivElement>(null)
  const vantaEffect = useRef<{ destroy: () => void } | null>(null)
  const animeInitRef = useRef(false)

  function initVanta() {
    if (
      vantaEffect.current ||
      !vantaRef.current ||
      typeof window === "undefined" ||
      !(window as unknown as Record<string, unknown>).VANTA
    ) return

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

  function initAnime() {
    if (animeInitRef.current) return
    if (typeof window === "undefined") return
    const animeLib = (window as unknown as Record<string, unknown>).anime
    if (!animeLib) return

    animeInitRef.current = true

    const textWrapper = document.querySelector(".ml12")
    if (!textWrapper) return

    textWrapper.innerHTML = (textWrapper.textContent ?? "").replace(
      /\S/g,
      "<span class='letter'>$&</span>"
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anime = animeLib as any
    anime.timeline({ loop: true })
      .add({
        targets: ".ml12 .letter",
        translateX: [40, 0],
        translateZ: 0,
        opacity: [0, 1],
        easing: "easeOutExpo",
        duration: 1200,
        delay: (_el: Element, i: number) => 500 + 30 * i,
      })
      .add({
        targets: ".ml12 .letter",
        translateX: [0, -30],
        opacity: [1, 0],
        easing: "easeInExpo",
        duration: 1100,
        delay: (_el: Element, i: number) => 100 + 30 * i,
      })
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
      {/* Google Font: Space Grotesk */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');`}</style>

      <Script src="/vanta/p5.min.js" strategy="afterInteractive" onLoad={initVanta} />
      <Script
        src="/vanta/vanta.topology.min.js"
        strategy="afterInteractive"
        onLoad={initVanta}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/animejs/2.0.2/anime.min.js"
        strategy="afterInteractive"
        onLoad={initAnime}
      />

      {/* Full-viewport Vanta canvas */}
      <div ref={vantaRef} className="fixed inset-0 z-0 bg-[hsl(222,30%,9%)]" />

      {/* Centered layout over canvas */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 gap-6">



        {/* Animated welcome heading */}
        <div className="text-center">
          <h1
            className="ml12"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 300,
              fontSize: "1.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.55em",
              color: "rgba(200, 220, 255, 0.82)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Welcome to EVA
          </h1>
        </div>

        {/* Page content (login / signup card) */}
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <style>{`
        .ml12 .letter {
          display: inline-block;
          line-height: 1em;
        }
      `}</style>
    </>
  )
}
