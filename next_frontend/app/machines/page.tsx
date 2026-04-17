"use client"

import { AppShell } from "@/components/shell/app-shell"
import { PageHeader } from "@/components/edge/page-header"
import { SectionCard } from "@/components/edge/section-card"
import { Spectrogram } from "@/components/edge/spectrogram"
import { ExplainabilityPanel } from "@/components/edge/explainability-panel"
import { RealtimeChart } from "@/components/edge/realtime-chart"
import { StatusCard } from "@/components/edge/status-card"
import { faultTimeline, machines } from "@/lib/mock-data"
import {
  Activity,
  ArrowLeft,
  CircuitBoard,
  Flame,
  Gauge,
  Radio,
  Wrench,
} from "lucide-react"
import Link from "next/link"

export default function MachineDetailPage() {
  const target = machines.find((m) => m.id === "RB-5502") ?? machines[0]

  return (
    <AppShell>
      <PageHeader
        eyebrow="Machine · Live"
        title={`${target.name}`}
        description="Deep-dive view of a single asset. Acoustic spectrogram, predicted fault window, and explainable drivers for the current recommendation."
        actions={
          <>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-accent/70 border border-border text-xs font-medium hover:bg-accent transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to fleet
            </Link>
            <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold glow-primary hover:brightness-110 transition">
              <Wrench className="w-3.5 h-3.5" />
              Schedule service
            </button>
          </>
        }
      />

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <StatusCard
          icon={Activity}
          label="Vibration RMS"
          value="0.74"
          unit="g"
          tone="crit"
          delta={{ value: "38%", direction: "up", positive: false }}
          sparkline={<RealtimeChart seed={101} color="#EF4444" height={56} amp={1.3} base={0.62} />}
        />
        <StatusCard
          icon={Radio}
          label="Acoustic Energy"
          value="41.2"
          unit="dB"
          tone="alert"
          delta={{ value: "12 dB", direction: "up", positive: false }}
          sparkline={<RealtimeChart seed={102} color="#F97316" height={56} amp={1.1} base={0.58} />}
        />
        <StatusCard
          icon={Flame}
          label="Housing Temp"
          value="91"
          unit="°C"
          tone="alert"
          delta={{ value: "4.2°C", direction: "up", positive: false }}
          sparkline={<RealtimeChart seed={103} color="#F97316" height={56} amp={0.7} base={0.55} />}
        />
        <StatusCard
          icon={Gauge}
          label="Predicted TTF"
          value="41"
          unit="h"
          tone="warn"
          delta={{ value: "down", direction: "down", positive: false }}
          sparkline={<RealtimeChart seed={104} color="#EAB308" height={56} amp={0.4} base={0.3} />}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Spectrogram */}
        <SectionCard
          className="xl:col-span-8"
          title="Acoustic Spectrogram"
          subtitle="Last 120 seconds · 0–8 kHz · Mel scaled"
          action={
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-status-alert animate-pulse" />
              Harmonic anomaly
            </div>
          }
        >
          <Spectrogram />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { k: "Peak Freq", v: "124 Hz" },
              { k: "Harmonic #", v: "3×" },
              { k: "Kurtosis", v: "4.8" },
              { k: "Band Energy", v: "+38%" },
            ].map((x) => (
              <div key={x.k} className="glass-strong rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {x.k}
                </p>
                <p className="mt-0.5 font-mono text-foreground">{x.v}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Explainability */}
        <SectionCard
          className="xl:col-span-4"
          title="Why this prediction?"
          subtitle="SHAP contributions · bearing-fault model"
          action={
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Conf 94%
            </span>
          }
        >
          <ExplainabilityPanel />
        </SectionCard>
      </div>

      {/* Timeline + details */}
      <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SectionCard
          className="xl:col-span-8"
          title="Fault Prediction Timeline"
          subtitle="EdgeSense detected drift 72 hours before predicted failure"
        >
          <div className="relative pl-6">
            <div className="absolute left-[10px] top-1 bottom-1 w-px bg-gradient-to-b from-primary via-status-alert to-status-crit opacity-60" />
            <div className="space-y-5">
              {faultTimeline.map((t) => {
                const color =
                  t.severity === "critical"
                    ? "#EF4444"
                    : t.severity === "warning"
                      ? "#EAB308"
                      : "#0EA5E9"
                return (
                  <div key={t.label} className="relative flex items-start gap-4">
                    <span
                      className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-background"
                      style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}` }}
                    />
                    <div className="flex-1 glass-strong rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                          {t.time}
                        </p>
                        <p className="mt-0.5 text-sm text-foreground font-medium">
                          {t.label}
                        </p>
                      </div>
                      <span
                        className="text-[10px] uppercase tracking-[0.16em] font-semibold"
                        style={{ color }}
                      >
                        {t.severity}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-4"
          title="Asset Profile"
          subtitle={target.id}
        >
          <div className="space-y-3 text-sm">
            {[
              { k: "Type", v: target.type },
              { k: "Location", v: target.location },
              { k: "Installed", v: "Feb 2022" },
              { k: "Last Service", v: "67 days ago" },
              { k: "Avg Uptime", v: "98.6%" },
              { k: "Model Baseline", v: "v2.4.1" },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
                  {r.k}
                </span>
                <span className="font-mono text-foreground">{r.v}</span>
              </div>
            ))}
            <div className="pt-2 flex items-center gap-2">
              <CircuitBoard className="w-4 h-4 text-primary" />
              <span className="text-xs text-foreground/90">
                Edge node <span className="font-mono">edge-02.bay3</span> streaming
                at <span className="font-mono">16 kHz</span>.
              </span>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  )
}
