"use client"

import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "ok" | "warn" | "alert" | "crit" | "neutral"

const toneStyles: Record<Tone, { dot: string; text: string; ring: string }> = {
  ok: { dot: "bg-status-ok", text: "text-status-ok", ring: "ring-status-ok/20" },
  warn: { dot: "bg-status-warn", text: "text-status-warn", ring: "ring-status-warn/20" },
  alert: { dot: "bg-status-alert", text: "text-status-alert", ring: "ring-status-alert/20" },
  crit: { dot: "bg-status-crit", text: "text-status-crit", ring: "ring-status-crit/20" },
  neutral: { dot: "bg-muted-foreground", text: "text-muted-foreground", ring: "ring-border" },
}

type Props = {
  icon: LucideIcon
  label: string
  value: string | number
  unit?: string
  delta?: { value: string; direction: "up" | "down"; positive?: boolean }
  tone?: Tone
  sparkline?: React.ReactNode
}

export function StatusCard({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  tone = "neutral",
  sparkline,
}: Props) {
  const s = toneStyles[tone]
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative glass rounded-2xl p-5 overflow-hidden"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            "radial-gradient(closest-side, rgba(14,165,233,0.18), transparent)",
        }}
      />
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
            <Icon className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <div className={cn("mt-1 inline-flex items-center gap-1.5 text-[11px]", s.text)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
              {tone === "ok"
                ? "Nominal"
                : tone === "warn"
                  ? "Watch"
                  : tone === "alert"
                    ? "Degraded"
                    : tone === "crit"
                      ? "Critical"
                      : "Live"}
            </div>
          </div>
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md border",
              delta.positive
                ? "text-status-ok bg-status-ok/8 border-status-ok/20"
                : "text-status-crit bg-status-crit/8 border-status-crit/20"
            )}
          >
            {delta.direction === "up" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {delta.value}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-baseline gap-1.5 font-display">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>

      {sparkline && <div className="mt-3 -mx-1">{sparkline}</div>}
    </motion.div>
  )
}
