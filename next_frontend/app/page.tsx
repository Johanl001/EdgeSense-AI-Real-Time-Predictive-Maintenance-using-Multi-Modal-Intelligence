"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/shell/app-shell"
import { PageHeader } from "@/components/edge/page-header"
import { HealthGauge } from "@/components/edge/health-gauge"
import { RealtimeChart } from "@/components/edge/realtime-chart"
import { StatusCard } from "@/components/edge/status-card"
import { LiveTicker } from "@/components/edge/live-ticker"
import { SectionCard } from "@/components/edge/section-card"
import { AlertCard } from "@/components/edge/alert-card"
import { machines as initialMachines, alerts as initialAlerts } from "@/lib/mock-data"
import { useWebSocket } from "@/hooks/use-websocket"
import {
  Activity,
  CircuitBoard,
  Flame,
  Gauge,
  Radio,
  ShieldCheck,
  Download,
  Plus,
} from "lucide-react"
import Link from "next/link"

export default function Dashboard() {
  const { data: wsData, isConnected } = useWebSocket("ws://127.0.0.1:8000/ws/stream")
  const [fleetMachines, setFleetMachines] = useState(initialMachines)
  const [liveAlerts, setLiveAlerts] = useState(initialAlerts)
  const [healthScore, setHealthScore] = useState(87)

  useEffect(() => {
    if (wsData?.type === "prediction") {
      const pred = wsData.data
      setHealthScore(pred.health_score)
      setFleetMachines(prev => {
        const next = [...prev]
        next[0] = {
          ...next[0],
          health: pred.health_score,
          status: pred.health_score > 80 ? "normal" : pred.health_score > 50 ? "warning" : "critical",
          lastSeen: "just now"
        }
        return next
      })

      if (pred.is_alert && liveAlerts[0]?.id !== pred.reading_id) {
         setLiveAlerts(prev => [
           {
             id: pred.reading_id,
             machineId: "MX-2041",
             machineName: "CNC Mill A1",
             title: `Alert: ${pred.fault_type}`,
             description: pred.explanation,
             severity: pred.health_score < 50 ? "critical" : "warning",
             timestamp: "just now",
             confidence: Math.round(pred.confidence * 100),
             recommendation: "Inspect machine based on prediction."
           },
           ...prev.slice(0, 4)
         ])
      }
    }
  }, [wsData, liveAlerts])

  const criticalAlerts = liveAlerts.filter((a) => a.severity === "critical").slice(0, 2)

  const handleExport = () => {
    const headers = ["ID", "Name", "Location", "Type", "Status", "Health Score", "RPM", "Temp (°C)"]
    const rows = fleetMachines.map((m) => [
      m.id,
      `"${m.name}"`,
      `"${m.location}"`,
      m.type,
      m.status,
      m.health,
      m.rpm,
      m.temp,
    ])
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "machine_report_edgesense.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Overview · Live"
        title="Predictive maintenance, in real time."
        description="EdgeSense is analyzing 128 acoustic and vibration streams across your fleet. The ML runtime is stable and predictions are flowing at sub-10ms latency."
        actions={
          <>
            <button 
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-accent/70 border border-border text-xs font-medium text-foreground hover:bg-accent transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export report
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition glow-primary">
              <Plus className="w-3.5 h-3.5" />
              Add machine
            </button>
          </>
        }
      />

      {/* Hero grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Health gauge hero */}
        <SectionCard
          className="xl:col-span-5"
          title="Fleet Intelligence"
          subtitle="Composite score across 24 assets"
          action={
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-status-ok animate-pulse' : 'bg-status-crit'} `} />
              {isConnected ? "Streaming" : "Offline"}
            </span>
          }
        >
          <div className="flex flex-col items-center pt-2 pb-4">
            <HealthGauge value={healthScore} />
            <div className="mt-6 grid grid-cols-3 gap-2 w-full">
              {[
                { k: "Healthy", v: fleetMachines.filter(m => m.status === 'normal').length, tone: "text-status-ok", dot: "bg-status-ok" },
                { k: "Watch", v: fleetMachines.filter(m => m.status === 'warning').length, tone: "text-status-warn", dot: "bg-status-warn" },
                { k: "Critical", v: fleetMachines.filter(m => m.status === 'critical').length, tone: "text-status-crit", dot: "bg-status-crit" },
              ].map((s) => (
                <div
                  key={s.k}
                  className="glass-strong rounded-xl p-3 flex flex-col items-center"
                >
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <span className={`w-1 h-1 rounded-full ${s.dot}`} />
                    {s.k}
                  </span>
                  <span className={`mt-1 font-display text-2xl font-semibold tabular-nums ${s.tone}`}>
                    {s.v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* KPI grid + charts */}
        <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5 content-start">
          <StatusCard
            icon={Activity}
            label="Vibration RMS"
            value="0.38"
            unit="g"
            tone="ok"
            delta={{ value: "2.1%", direction: "down", positive: true }}
            sparkline={<RealtimeChart seed={11} color="#0EA5E9" height={56} amp={0.8} base={0.55} />}
          />
          <StatusCard
            icon={Radio}
            label="Acoustic SNR"
            value="28.4"
            unit="dB"
            tone="warn"
            delta={{ value: "4.8%", direction: "down", positive: false }}
            sparkline={<RealtimeChart seed={22} color="#EAB308" height={56} amp={1.1} base={0.48} />}
          />
          <StatusCard
            icon={Flame}
            label="Thermal Load"
            value="62"
            unit="°C"
            tone="ok"
            delta={{ value: "0.4%", direction: "up", positive: false }}
            sparkline={<RealtimeChart seed={33} color="#22C55E" height={56} amp={0.6} base={0.52} />}
          />
          <StatusCard
            icon={Gauge}
            label="Inference Latency"
            value="6.2"
            unit="ms"
            tone="ok"
            delta={{ value: "0.8ms", direction: "down", positive: true }}
            sparkline={<RealtimeChart seed={44} color="#A78BFA" height={56} amp={0.4} base={0.35} />}
          />

          {/* Realtime chart wide */}
          <SectionCard
            className="sm:col-span-2"
            title="Vibration · 3-axis"
            subtitle="CNC Mill A1 · window = 60s"
            action={
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> X
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Y
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Z
                </span>
              </div>
            }
          >
            <div className="relative">
              <div className="absolute inset-0 opacity-80">
                <RealtimeChart seed={91} color="#A78BFA" height={200} amp={1.1} base={0.52} ariaLabel="Z axis" />
              </div>
              <div className="absolute inset-0 opacity-80">
                <RealtimeChart seed={92} color="#22D3EE" height={200} amp={0.9} base={0.5} ariaLabel="Y axis" />
              </div>
              <div className="relative">
                <RealtimeChart seed={93} color="#0EA5E9" height={200} amp={1} base={0.5} ariaLabel="X axis" />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Ticker */}
      <div className="mt-5">
        <LiveTicker />
      </div>

      {/* Lower grid: machines + alerts */}
      <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SectionCard
          className="xl:col-span-7"
          title="Asset Fleet"
          subtitle="Live status across all monitored machinery"
          action={
            <Link
              href="/machines"
              className="text-xs text-primary hover:text-primary/80 transition"
            >
              Open machine detail →
            </Link>
          }
          padded={false}
        >
          <div className="divide-y divide-border/60">
            {fleetMachines.map((m) => {
              const tone =
                m.status === "normal"
                  ? "text-status-ok"
                  : m.status === "warning"
                    ? "text-status-warn"
                    : m.status === "critical"
                      ? "text-status-crit"
                      : "text-muted-foreground"
              const dot =
                m.status === "normal"
                  ? "bg-status-ok"
                  : m.status === "warning"
                    ? "bg-status-warn"
                    : m.status === "critical"
                      ? "bg-status-crit"
                      : "bg-muted-foreground"
              return (
                <div
                  key={m.id}
                  className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 hover:bg-accent/40 transition-colors"
                >
                  <div className="col-span-5 min-w-0 flex items-center gap-3">
                    <div className="relative grid place-items-center w-9 h-9 rounded-xl bg-accent/60 border border-border/60 shrink-0">
                      <CircuitBoard className="w-4 h-4 text-muted-foreground" />
                      <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dot}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate font-medium">
                        {m.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate font-mono">
                        {m.id} · {m.location}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 hidden md:flex items-center gap-1.5 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    <span className={tone}>
                      {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${m.health}%`,
                          background:
                            m.health >= 85
                              ? "linear-gradient(90deg, #22C55E, #0EA5E9)"
                              : m.health >= 65
                                ? "linear-gradient(90deg, #EAB308, #F97316)"
                                : "linear-gradient(90deg, #F97316, #EF4444)",
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono tabular-nums text-foreground w-8 text-right">
                      {m.health}
                    </span>
                  </div>
                  <div className="col-span-2 text-right text-[11px] text-muted-foreground font-mono">
                    {m.lastSeen}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-5"
          title="Critical Signals"
          subtitle="High-priority predictions in the last 60 minutes"
          action={
            <Link
              href="/alerts"
              className="text-xs text-primary hover:text-primary/80 transition"
            >
              View all →
            </Link>
          }
        >
          <div className="space-y-3">
            {criticalAlerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
            <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-status-ok" />
              EdgeSense prevented <span className="text-foreground">3 unplanned outages</span> this week.
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  )
}
