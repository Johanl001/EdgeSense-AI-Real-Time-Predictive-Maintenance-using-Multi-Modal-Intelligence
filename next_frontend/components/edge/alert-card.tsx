"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, AlertTriangle, Info, ShieldAlert, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AlertItem } from "@/lib/mock-data"

const severityStyles = {
  info: {
    icon: Info,
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    label: "Info",
    dot: "bg-primary",
  },
  warning: {
    icon: AlertTriangle,
    text: "text-status-warn",
    bg: "bg-status-warn/10",
    border: "border-status-warn/25",
    label: "Warning",
    dot: "bg-status-warn",
  },
  critical: {
    icon: ShieldAlert,
    text: "text-status-crit",
    bg: "bg-status-crit/10",
    border: "border-status-crit/25",
    label: "Critical",
    dot: "bg-status-crit",
  },
} as const

export function AlertCard({ alert }: { alert: AlertItem }) {
  const [open, setOpen] = useState(alert.severity === "critical")
  const s = severityStyles[alert.severity]
  const Icon = s.icon
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass rounded-2xl overflow-hidden",
        alert.severity === "critical" && "glow-danger"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-accent/40 transition-colors"
        aria-expanded={open}
      >
        <div className={cn("grid place-items-center w-10 h-10 rounded-xl shrink-0 border", s.bg, s.border)}>
          <Icon className={cn("w-[18px] h-[18px]", s.text)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 px-2 h-5 rounded-md text-[10px] uppercase tracking-[0.14em] font-semibold border", s.bg, s.border, s.text)}>
              <span className={cn("w-1 h-1 rounded-full", s.dot)} />
              {s.label}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {alert.machineId}
            </span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">{alert.machineName}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {alert.timestamp}
            </span>
          </div>
          <h4 className="mt-1.5 font-display text-[15px] font-semibold text-foreground tracking-tight">
            {alert.title}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
            {alert.description}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-mono tabular-nums text-foreground">
              {alert.confidence}%
            </span>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/60">
              <div className="md:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Full signal
                </p>
                <p className="mt-1.5 text-sm text-foreground/90 leading-relaxed">
                  {alert.description}
                </p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Recommendation
                </p>
                <p className="mt-1.5 text-sm text-foreground/90 leading-relaxed">
                  {alert.recommendation}
                </p>
              </div>
              <div className="glass-strong rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Model Confidence
                  </p>
                  <div className="mt-2 flex items-baseline gap-1 font-display">
                    <span className="text-2xl font-semibold tabular-nums">
                      {alert.confidence}
                    </span>
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-accent overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-violet-400"
                      style={{ width: `${alert.confidence}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition">
                    Acknowledge
                  </button>
                  <button className="flex-1 h-8 rounded-lg bg-accent/80 border border-border text-xs font-medium hover:bg-accent transition">
                    Dispatch
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
