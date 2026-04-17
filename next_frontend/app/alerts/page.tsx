"use client"

import { useMemo, useState } from "react"
import { AppShell } from "@/components/shell/app-shell"
import { PageHeader } from "@/components/edge/page-header"
import { AlertCard } from "@/components/edge/alert-card"
import { SectionCard } from "@/components/edge/section-card"
import { alerts } from "@/lib/mock-data"
import { Filter, ShieldAlert, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertFilter = "all" | "critical" | "warning" | "info"

export default function AlertsPage() {
  const [filter, setFilter] = useState<AlertFilter>("all")

  const counts = useMemo(
    () => ({
      all: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
    }),
    []
  )

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter)

  const tabs: { key: AlertFilter; label: string; icon: React.ElementType; tone: string }[] = [
    { key: "all", label: "All", icon: Filter, tone: "text-foreground" },
    { key: "critical", label: "Critical", icon: ShieldAlert, tone: "text-status-crit" },
    { key: "warning", label: "Warning", icon: AlertTriangle, tone: "text-status-warn" },
    { key: "info", label: "Info", icon: Info, tone: "text-primary" },
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow="Signals"
        title="Alerts & Predictions"
        description="Every prediction is timestamped, explainable, and actionable. Expand a card to see the recommendation and dispatch options."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {tabs.map((t) => {
          const active = filter === t.key
          const Icon = t.icon
          const count = counts[t.key]
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "glass rounded-2xl p-4 text-left transition-all relative overflow-hidden",
                active
                  ? "border-primary/40 ring-1 ring-primary/30"
                  : "hover:border-border/80"
              )}
            >
              {active && (
                <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
              )}
              <div className="relative flex items-center justify-between">
                <Icon className={cn("w-4 h-4", t.tone)} />
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {active ? "Selected" : "Filter"}
                </span>
              </div>
              <p className="relative mt-3 font-display text-2xl font-semibold tabular-nums">
                {count}
              </p>
              <p className="relative text-xs text-muted-foreground">{t.label}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-3">
          {filtered.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
          {filtered.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
              No alerts match this filter.
            </div>
          )}
        </div>

        <div className="xl:col-span-4 space-y-5">
          <SectionCard title="Alert Velocity" subtitle="Per hour, last 24h">
            <div className="flex items-end gap-1 h-32">
              {[4, 7, 5, 9, 6, 11, 14, 10, 8, 12, 15, 18, 22, 19, 16, 13, 15, 17, 21, 24, 20, 17, 14, 11].map(
                (v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-primary/20 to-primary/70"
                    style={{ height: `${(v / 24) * 100}%` }}
                    title={`${v} alerts`}
                  />
                )
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>00:00</span>
              <span>12:00</span>
              <span>now</span>
            </div>
          </SectionCard>

          <SectionCard title="Auto-Response Playbooks" subtitle="Runs within 30s of detection">
            <div className="space-y-3">
              {[
                { k: "Bearing harmonic detected", v: "Slack #maint + dispatch", tone: "text-status-crit" },
                { k: "Thermal drift > 3°C/h", v: "Notify shift lead", tone: "text-status-warn" },
                { k: "Acoustic SNR drop", v: "Log + continue monitor", tone: "text-primary" },
              ].map((p) => (
                <div
                  key={p.k}
                  className="flex items-start justify-between gap-3 glass-strong rounded-xl px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs text-foreground font-medium">{p.k}</p>
                    <p className="text-[11px] text-muted-foreground">{p.v}</p>
                  </div>
                  <span className={cn("text-[10px] uppercase tracking-[0.16em]", p.tone)}>
                    Active
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  )
}
