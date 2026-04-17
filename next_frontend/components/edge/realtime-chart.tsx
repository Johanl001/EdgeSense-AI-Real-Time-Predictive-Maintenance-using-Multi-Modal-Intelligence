"use client"

import { useEffect, useRef, useState } from "react"
import { generateWaveSeries } from "@/lib/mock-data"

type Props = {
  color?: string
  seed?: number
  height?: number
  amp?: number
  base?: number
  ariaLabel?: string
}

const POINTS = 80

export function RealtimeChart({
  color = "#0EA5E9",
  seed = 1,
  height = 160,
  amp = 1,
  base = 0.5,
  ariaLabel = "Real-time telemetry",
}: Props) {
  const [data, setData] = useState<number[]>(() =>
    generateWaveSeries(POINTS, seed, amp, base)
  )
  const tick = useRef(0)

  useEffect(() => {
    const rnd = () => {
      // simple deterministic-ish noise
      tick.current += 1
      const t = tick.current
      const target =
        base + Math.sin(t / 5) * 0.25 * amp + (Math.random() - 0.5) * 0.22 * amp
      return target
    }
    const id = setInterval(() => {
      setData((prev) => {
        const next = prev.slice(1)
        const last = prev[prev.length - 1]
        const target = rnd()
        const val = last + (target - last) * 0.55
        next.push(Math.max(0.02, Math.min(0.98, val)))
        return next
      })
    }, 900)
    return () => clearInterval(id)
  }, [amp, base])

  const W = 600
  const H = height
  const pad = 8
  const stepX = (W - pad * 2) / (POINTS - 1)

  const points = data.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - v) * (H - pad * 2)
    return [x, y] as const
  })

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ")

  const areaPath =
    linePath +
    ` L ${pad + (POINTS - 1) * stepX} ${H - pad} L ${pad} ${H - pad} Z`

  const last = points[points.length - 1]
  const gradId = `line-grad-${seed}`
  const areaId = `area-grad-${seed}`

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        <linearGradient id={areaId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((f) => {
        const y = pad + f * (H - pad * 2)
        return (
          <line
            key={f}
            x1={pad}
            x2={W - pad}
            y1={y}
            y2={y}
            stroke="rgba(148,163,184,0.08)"
            strokeDasharray="2 4"
          />
        )
      })}

      <path d={areaPath} fill={`url(#${areaId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Live point */}
      <circle cx={last[0]} cy={last[1]} r={8} fill={color} opacity={0.15} />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
    </svg>
  )
}
