"use client"

const items = [
  { k: "CNC-MILL-A1", v: "vib 0.38g", tone: "text-status-ok" },
  { k: "PRESS-B4", v: "temp 78°C", tone: "text-status-warn" },
  { k: "CONVEYOR-C2", v: "rpm 1420", tone: "text-status-ok" },
  { k: "ROBOT-R7", v: "bearing anomaly · 94%", tone: "text-status-crit" },
  { k: "COMP-U3", v: "psi 121", tone: "text-status-ok" },
  { k: "PUMP-T9", v: "flow Δ +2.1%", tone: "text-status-warn" },
  { k: "EDGE-02", v: "heartbeat 12ms", tone: "text-status-ok" },
  { k: "MODEL-v2.4", v: "inference 6.2ms", tone: "text-status-ok" },
]

export function LiveTicker() {
  const doubled = [...items, ...items]
  return (
    <div className="relative overflow-hidden glass rounded-2xl">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5 shrink-0 pr-4 border-r border-border/60">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-primary" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Live Feed
          </span>
        </div>
        <div className="relative overflow-hidden flex-1">
          <div className="flex gap-8 animate-ticker whitespace-nowrap will-change-transform">
            {doubled.map((it, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">{it.k}</span>
                <span className={`font-mono ${it.tone}`}>{it.v}</span>
                <span className="text-border">·</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
