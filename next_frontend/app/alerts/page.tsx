"use client"

import { useMemo, useState, useEffect } from "react"
import { AppShell } from "@/components/shell/app-shell"
import { PageHeader } from "@/components/edge/page-header"
import { AlertCard } from "@/components/edge/alert-card"
import { SectionCard } from "@/components/edge/section-card"
import { useWebSocket } from "@/hooks/use-websocket"
import { Filter, ShieldAlert, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertFilter = "all" | "critical" | "warning" | "info"

type LiveAlert = {
  id: string
  machineId: string
  machineName: string
  title: string
  description: string
  severity: "critical" | "warning" | "info"
  timestamp: string
  confidence: number
  recommendation: string
}

function severityFromScore(score: number): "critical" | "warning" | "info" {
  if (score < 40) return "critical"
  if (score < 70) return "warning"
  return "info"
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<AlertFilter>("all")
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([])
  const [velocityBars, setVelocityBars] = useState<number[]>(
    [4, 7, 5, 9, 6, 11, 14, 10, 8, 12, 15, 18, 22, 19, 16, 13, 15, 17, 21, 24, 20, 17, 14, 11]
  )

  const { data: wsData, isConnected } = useWebSocket(
    process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8000/ws/stream"
  )

  // Pull live predictions from WebSocket and convert to alerts
  useEffect(() => {
    if (wsData?.type !== "prediction") return
    const pred = wsData.data
    const severity = severityFromScore(pred.health_score)

    const newAlert: LiveAlert = {
      id: pred.reading_id,
      machineId: pred.device_id ?? "ESP32-001",
      machineName: "CNC Mill A1",
      title: pred.fault_type === "Normal"
        ? "System nominal"
        : `${pred.fault_type} detected`,
      description: pred.explanation,
      severity: pred.fault_type === "Normal" ? "info" : severity,
      timestamp: new Date(pred.timestamp).toLocaleTimeString(),
      confidence: Math.round(pred.confidence * 100),
      recommendation: pred.explanation,
    }

    setLiveAlerts(prev => {
      // Avoid duplicate readings
      if (prev[0]?.id === newAlert.id) return prev
      const updated = [newAlert, ...prev].slice(0, 50)
      return updated
    })

    // Tick the velocity bar chart on every new prediction
    setVelocityBars(prev => {
      const next = [...prev.slice(1), prev[prev.length - 1] + (severity !== "info" ? 1 : 0)]
      return next
    })
  }, [wsData])

  const alerts = liveAlerts

  const counts = useMemo(() => ({
    all: alerts.length,
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info: alerts.filter(a => a.severity === "info").length,
  }), [alerts])

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.severity === filter)

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

      {/* Live connection badge */}
      <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
        <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-status-ok animate-pulse" : "bg-status-crit"}`} />
        {isConnected
          ? `Live — ${alerts.length} prediction${alerts.length !== 1 ? "s" : ""} received this session`
          : "Connecting to EdgeSense backend…"}
      </div>

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
                active ? "border-primary/40 ring-1 ring-primary/30" : "hover:border-border/80"
              )}
            >
              {active && <div className="absolute inset-0 bg-primary/5 pointer-events-none" />}
              <div className="relative flex items-center justify-between">
                <Icon className={cn("w-4 h-4", t.tone)} />
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {active ? "Selected" : "Filter"}
                </span>
              </div>
              <p className="relative mt-3 font-display text-2xl font-semibold tabular-nums">{count}</p>
              <p className="relative text-xs text-muted-foreground">{t.label}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-3">
          {filtered.length === 0 && !isConnected && (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
              Waiting for backend connection…
            </div>
          )}
          {filtered.length === 0 && isConnected && (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
              No alerts match this filter. Machine is healthy.
            </div>
          )}
          {filtered.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>

        <div className="xl:col-span-4 space-y-5">
          <SectionCard title="Alert velocity" subtitle="Last 24 readings">
            <div className="flex items-end gap-1 h-32">
              {velocityBars.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-primary/20 to-primary/70"
                  style={{ height: `${Math.min(100, (v / Math.max(...velocityBars, 1)) * 100)}%` }}
                  title={`${v} alerts`}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>older</span>
              <span>now</span>
            </div>
          </SectionCard>

          {/* Live last prediction stats */}
          {wsData?.data && (
            <SectionCard title="Last prediction" subtitle="Raw values from ESP32">
              <div className="space-y-2 text-xs font-mono">
                {[
                  { k: "Health score", v: `${wsData.data.health_score}/100` },
                  { k: "Fault type", v: wsData.data.fault_type },
                  { k: "Risk level", v: wsData.data.risk_level },
                  { k: "Confidence", v: `${Math.round(wsData.data.confidence * 100)}%` },
                  { k: "Is alert", v: wsData.data.is_alert ? "Yes" : "No" },
                ].map(row => (
                  <div key={row.k} className="flex justify-between gap-2 glass-strong rounded-lg px-3 py-2">
                    <span className="text-muted-foreground">{row.k}</span>
                    <span className={cn(
                      "font-medium",
                      row.k === "Health score"
                        ? wsData.data.health_score > 70
                          ? "text-status-ok"
                          : wsData.data.health_score > 40
                            ? "text-status-warn"
                            : "text-status-crit"
                        : "text-foreground"
                    )}>{row.v}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Auto-response playbooks" subtitle="Runs within 30s of detection">
            <div className="space-y-3">
              {[
                { k: "Bearing harmonic detected", v: "Slack #maint + dispatch", tone: "text-status-crit" },
                { k: "Thermal drift > 3°C/h", v: "Notify shift lead", tone: "text-status-warn" },
                { k: "Acoustic SNR drop", v: "Log + continue monitor", tone: "text-primary" },
              ].map(p => (
                <div key={p.k} className="flex items-start justify-between gap-3 glass-strong rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-xs text-foreground font-medium">{p.k}</p>
                    <p className="text-[11px] text-muted-foreground">{p.v}</p>
                  </div>
                  <span className={cn("text-[10px] uppercase tracking-[0.16em]", p.tone)}>Active</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  )
}