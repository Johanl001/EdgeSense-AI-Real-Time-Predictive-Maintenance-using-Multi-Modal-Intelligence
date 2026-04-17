"use client"

import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { useEffect, useState } from "react"

type Props = {
  value: number // 0-100
  size?: number
  label?: string
  sublabel?: string
}

export function HealthGauge({
  value,
  size = 320,
  label = "Fleet Health",
  sublabel = "Composite score · all assets",
}: Props) {
  const stroke = 18
  const radius = (size - stroke) / 2 - 6
  const cx = size / 2
  const cy = size / 2
  const startAngle = 135
  const endAngle = 405 // 270deg sweep
  const sweep = endAngle - startAngle

  const polar = (angle: number) => {
    const rad = (angle * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const arcPath = (a0: number, a1: number) => {
    const p0 = polar(a0)
    const p1 = polar(a1)
    const large = a1 - a0 > 180 ? 1 : 0
    return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y}`
  }

  const mv = useMotionValue(0)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
    })
    const unsub = mv.on("change", (v) => setDisplay(Math.round(v)))
    return () => {
      controls.stop()
      unsub()
    }
  }, [value, mv])

  const arcLen = useTransform(mv, (v) => (v / 100) * sweep)
  const endForValue = useTransform(arcLen, (l) => startAngle + l)
  const [endAngleVal, setEndAngleVal] = useState(startAngle)
  useEffect(() => {
    const unsub = endForValue.on("change", setEndAngleVal)
    return () => unsub()
  }, [endForValue])

  const pointer = polar(endAngleVal)

  const tone =
    display >= 85 ? "ok" : display >= 65 ? "warn" : display >= 40 ? "alert" : "crit"

  const toneColor = {
    ok: "#22C55E",
    warn: "#EAB308",
    alert: "#F97316",
    crit: "#EF4444",
  }[tone]

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="45%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
          <radialGradient id="gauge-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(14,165,233,0.22)" />
            <stop offset="60%" stopColor="rgba(14,165,233,0.06)" />
            <stop offset="100%" stopColor="rgba(14,165,233,0)" />
          </radialGradient>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Core glow */}
        <circle cx={cx} cy={cy} r={radius - 6} fill="url(#gauge-core)" />

        {/* Track */}
        <path
          d={arcPath(startAngle, endAngle)}
          stroke="rgba(148,163,184,0.12)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {Array.from({ length: 28 }).map((_, i) => {
          const a = startAngle + (i / 27) * sweep
          const p1 = polar(a)
          const rInner = radius + 16
          const rad = (a * Math.PI) / 180
          const p2 = {
            x: cx + rInner * Math.cos(rad),
            y: cy + rInner * Math.sin(rad),
          }
          const active = a <= endAngleVal
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={active ? "rgba(14,165,233,0.7)" : "rgba(148,163,184,0.18)"}
              strokeWidth={1.25}
            />
          )
        })}

        {/* Active arc */}
        <motion.path
          d={arcPath(startAngle, Math.max(startAngle + 0.01, endAngleVal))}
          stroke="url(#gauge-grad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          filter="url(#gauge-glow)"
        />

        {/* Pointer */}
        <circle
          cx={pointer.x}
          cy={pointer.y}
          r={8}
          fill={toneColor}
          stroke="rgba(11,15,25,1)"
          strokeWidth={3}
        />
        <circle cx={pointer.x} cy={pointer.y} r={14} fill={toneColor} opacity={0.15} />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
        <div className="mt-1 flex items-baseline gap-1 font-display">
          <span className="text-gradient-primary text-6xl font-semibold tabular-nums leading-none">
            {display}
          </span>
          <span className="text-lg text-muted-foreground">%</span>
        </div>
        <span className="mt-2 text-xs text-muted-foreground">{sublabel}</span>
        <span
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-medium"
          style={{ color: toneColor }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: toneColor, boxShadow: `0 0 12px ${toneColor}` }}
          />
          {tone === "ok"
            ? "Optimal"
            : tone === "warn"
              ? "Monitor"
              : tone === "alert"
                ? "Degraded"
                : "Critical"}
        </span>
      </div>
    </div>
  )
}
