"use client"

import { useMemo } from "react"
import { generateSpectrogram } from "@/lib/mock-data"

export function Spectrogram({ cols = 72, rows = 18 }: { cols?: number; rows?: number }) {
  const data = useMemo(() => generateSpectrogram(cols, rows), [cols, rows])

  const colorFor = (v: number) => {
    // Map intensity → teal→blue→violet→orange for hot
    if (v < 0.15) return `rgba(14,165,233,${0.08 + v})`
    if (v < 0.4) return `rgba(34,211,238,${0.3 + v * 0.4})`
    if (v < 0.65) return `rgba(167,139,250,${0.35 + v * 0.4})`
    if (v < 0.85) return `rgba(249,115,22,${0.45 + v * 0.4})`
    return `rgba(239,68,68,${0.65 + v * 0.35})`
  }

  return (
    <div className="relative w-full">
      <div className="relative rounded-xl overflow-hidden bg-[#060912] border border-border/60">
        <svg
          viewBox={`0 0 ${cols} ${rows}`}
          className="w-full h-[220px]"
          preserveAspectRatio="none"
        >
          {data.map((row, y) =>
            row.map((v, x) => (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={colorFor(v)}
              />
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_30%,transparent_70%,rgba(0,0,0,0.3))]" />

        <div className="absolute top-2 left-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
          8 kHz
        </div>
        <div className="absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
          0 Hz
        </div>
        <div className="absolute bottom-2 right-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
          Now
        </div>
        <div className="absolute top-2 right-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-status-alert">
          <span className="w-1.5 h-1.5 rounded-full bg-status-alert animate-pulse" />
          Anomaly @ 124 Hz
        </div>
      </div>
    </div>
  )
}
