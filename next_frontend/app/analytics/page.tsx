import { AppShell } from "@/components/shell/app-shell"
import { PageHeader } from "@/components/edge/page-header"
import { SectionCard } from "@/components/edge/section-card"
import { HeatmapGrid } from "@/components/edge/heatmap-grid"
import { RealtimeChart } from "@/components/edge/realtime-chart"
import { ChevronDown, Download } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="History"
        title="Analytics & Anomaly Trends"
        description="Six months of fleet-wide anomaly density, fault-type distributions, and model accuracy — all scoped to the filters you care about."
        actions={
          <>
            <FilterPill label="Last 26 weeks" />
            <FilterPill label="All machines" />
            <FilterPill label="All fault types" />
            <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition glow-primary">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </>
        }
      />

      <SectionCard
        title="Anomaly Density"
        subtitle="Daily anomaly intensity across the fleet"
        action={
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>2,184 events</span>
            <span className="text-border">·</span>
            <span className="text-status-ok">+12% vs prev period</span>
          </div>
        }
      >
        <HeatmapGrid weeks={26} />
      </SectionCard>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SectionCard
          className="xl:col-span-7"
          title="Model Accuracy · 90 days"
          subtitle="Precision / Recall against labeled outcomes"
        >
          <div className="relative">
            <div className="absolute inset-0 opacity-90">
              <RealtimeChart seed={55} color="#A78BFA" height={220} amp={0.3} base={0.6} ariaLabel="Recall" />
            </div>
            <div className="relative">
              <RealtimeChart seed={56} color="#0EA5E9" height={220} amp={0.25} base={0.7} ariaLabel="Precision" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { k: "Precision", v: "0.942", d: "+1.3%" },
              { k: "Recall", v: "0.911", d: "+0.7%" },
              { k: "F1", v: "0.926", d: "+1.0%" },
            ].map((x) => (
              <div key={x.k} className="glass-strong rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {x.k}
                </p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                  {x.v}
                </p>
                <p className="text-[11px] text-status-ok">{x.d}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-5"
          title="Fault Distribution"
          subtitle="Share of predicted faults by type"
        >
          <div className="space-y-4">
            {[
              { k: "Bearing wear", v: 42, color: "#0EA5E9" },
              { k: "Misalignment", v: 24, color: "#22D3EE" },
              { k: "Lubrication", v: 16, color: "#A78BFA" },
              { k: "Thermal", v: 12, color: "#F97316" },
              { k: "Electrical", v: 6, color: "#22C55E" },
            ].map((d) => (
              <div key={d.k}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground/90">{d.k}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {d.v}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-accent/70 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${d.v}%`,
                      background: `linear-gradient(90deg, ${d.color}AA, ${d.color})`,
                      boxShadow: `0 0 14px ${d.color}55`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-border/60 grid grid-cols-2 gap-3">
            <Metric k="MTBF" v="1,284h" />
            <Metric k="MTTR" v="2h 18m" />
            <Metric k="Prevented" v="18 incidents" />
            <Metric k="Saved" v="$412k est." />
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { k: "CNC Mill A1", v: 94, tone: "#22C55E" },
          { k: "Press B4", v: 71, tone: "#EAB308" },
          { k: "Robot R7", v: 42, tone: "#EF4444" },
          { k: "Pump T9", v: 76, tone: "#EAB308" },
        ].map((c) => (
          <SectionCard key={c.k} title={c.k} subtitle="Health index · 7d trend">
            <RealtimeChart seed={c.k.length + 71} color={c.tone} height={100} amp={0.6} base={0.55} />
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-display text-3xl font-semibold tabular-nums" style={{ color: c.tone }}>
                {c.v}
              </span>
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Score
              </span>
            </div>
          </SectionCard>
        ))}
      </div>
    </AppShell>
  )
}

function FilterPill({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-accent/70 border border-border text-xs font-medium text-foreground hover:bg-accent transition">
      {label}
      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
    </button>
  )
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="glass-strong rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{k}</p>
      <p className="mt-0.5 font-mono text-foreground">{v}</p>
    </div>
  )
}
