"use client"

import { useState } from "react"
import { AppShell } from "@/components/shell/app-shell"
import { PageHeader } from "@/components/edge/page-header"
import { SectionCard } from "@/components/edge/section-card"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Bell, Brain, Cloud, Shield, Users } from "lucide-react"

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Tune detection thresholds, notification routing, and model deployment. Changes propagate to all edge nodes within 30 seconds."
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-5">
          <SectionCard
            title="Detection Thresholds"
            subtitle="Per-signal sensitivity for the fleet model"
          >
            <div className="space-y-6">
              <Slider label="Vibration RMS alert threshold" min={0} max={1} unit="g" initial={0.45} />
              <Slider label="Acoustic kurtosis threshold" min={0} max={10} unit="" initial={4.2} />
              <Slider label="Thermal drift rate" min={0} max={10} unit="°C/h" initial={3} />
              <Slider label="Min model confidence to dispatch" min={0} max={1} unit="" initial={0.8} />
            </div>
          </SectionCard>

          <SectionCard title="Notifications" subtitle="Where critical predictions are routed">
            <div className="divide-y divide-border/60">
              <Toggle
                icon={Bell}
                title="Push notifications"
                desc="Browser + mobile app (if installed)"
                initial
              />
              <Toggle
                icon={Cloud}
                title="Slack · #plant-ops"
                desc="Critical-only, with explainability attached"
                initial
              />
              <Toggle
                icon={Users}
                title="On-call dispatch"
                desc="Auto-page the shift engineer after 2 min"
              />
              <Toggle
                icon={Shield}
                title="Executive digest"
                desc="Weekly PDF summary to leadership"
                initial
              />
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-4 space-y-5">
          <SectionCard title="Model Deployment" subtitle="Currently serving across 12 edge nodes">
            <div className="glass-strong rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-10 h-10 rounded-xl bg-primary/15 text-primary glow-primary">
                  <Brain className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium font-display">
                    edgesense-bearing
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    v2.4.1 · int8 · 3.2 MB
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-status-ok">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-ok" /> Live
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "Recall", v: "0.91" },
                  { k: "Precision", v: "0.94" },
                  { k: "Lat", v: "6.2ms" },
                ].map((x) => (
                  <div key={x.k} className="rounded-lg bg-accent/60 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {x.k}
                    </p>
                    <p className="font-mono text-sm text-foreground">{x.v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110">
                  Promote v2.5 canary
                </button>
                <button className="h-9 px-3 rounded-lg bg-accent/70 border border-border text-xs">
                  Rollback
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Data Residency" subtitle="Control where acoustic data is stored">
            <div className="space-y-2">
              {[
                { k: "EU (Frankfurt)", active: true },
                { k: "US (Virginia)", active: false },
                { k: "APAC (Singapore)", active: false },
              ].map((r) => (
                <label
                  key={r.k}
                  className="flex items-center justify-between glass-strong rounded-xl px-3 py-2.5 cursor-pointer hover:border-primary/30"
                >
                  <span className="text-sm text-foreground/90">{r.k}</span>
                  <input
                    type="radio"
                    defaultChecked={r.active}
                    name="residency"
                    className="accent-[color:var(--primary)]"
                  />
                </label>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Danger Zone" subtitle="Irreversible actions">
            <button className="w-full h-10 rounded-xl border border-status-crit/40 bg-status-crit/10 text-status-crit text-xs font-semibold hover:bg-status-crit/15 transition">
              Reset all baselines
            </button>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  )
}

function Slider({
  label,
  min,
  max,
  unit,
  initial,
}: {
  label: string
  min: number
  max: number
  unit: string
  initial: number
}) {
  const [val, setVal] = useState(initial)
  const pct = ((val - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-foreground/90">{label}</span>
        <span className="font-mono text-foreground">
          {val.toFixed(2)} {unit}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-accent/70 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-cyan-400 to-violet-400"
          style={{ width: `${pct}%`, boxShadow: "0 0 14px rgba(14,165,233,0.4)" }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={(max - min) / 100}
        value={val}
        onChange={(e) => setVal(parseFloat(e.target.value))}
        className="w-full mt-2 appearance-none bg-transparent cursor-pointer accent-[color:var(--primary)]"
        aria-label={label}
      />
    </div>
  )
}

function Toggle({
  icon: Icon,
  title,
  desc,
  initial = false,
}: {
  icon: React.ElementType
  title: string
  desc: string
  initial?: boolean
}) {
  const [on, setOn] = useState(initial)
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="grid place-items-center w-9 h-9 rounded-xl bg-accent/60 border border-border/60 text-muted-foreground">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          "relative w-11 h-6 rounded-full border transition-colors",
          on ? "bg-primary/80 border-primary/40 glow-primary" : "bg-accent/70 border-border"
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-foreground shadow",
            on ? "right-0.5" : "left-0.5"
          )}
        />
      </button>
    </div>
  )
}
