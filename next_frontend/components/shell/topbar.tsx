"use client"

import { useEffect, useState } from "react"
import { Search, Bell, Cpu, Waves, Wifi } from "lucide-react"

export function Topbar() {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="h-full px-6 flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-status-ok/10 text-status-ok border border-status-ok/20">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-status-ok opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-ok" />
            </span>
            System Nominal
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-accent/60 border border-border/60">
            <Wifi className="w-3 h-3 text-primary" />
            WSS · 12ms
          </span>
          <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-accent/60 border border-border/60">
            <Cpu className="w-3 h-3 text-primary" />
            Edge v2.4.1
          </span>
        </div>

        <div className="flex-1 max-w-lg mx-auto hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search machines, alerts, fault codes…"
              className="w-full h-9 pl-9 pr-16 rounded-xl bg-accent/60 border border-border/60 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
            />
            <kbd className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-6 items-center px-1.5 rounded-md border border-border/60 text-[10px] text-muted-foreground bg-background/60">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="font-mono text-sm tabular-nums text-foreground">
              {time || "--:--:--"}
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              UTC · Live Telemetry
            </span>
          </div>
          <button
            className="relative grid place-items-center w-9 h-9 rounded-xl bg-accent/60 border border-border/60 hover:bg-accent transition-colors"
            aria-label="Open alerts"
          >
            <Bell className="w-4 h-4 text-foreground" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-status-crit animate-pulse-ring" />
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-border/60">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-violet-500 grid place-items-center font-display text-xs font-semibold text-background">
                NS
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-ok ring-2 ring-background" />
            </div>
            <div className="hidden lg:flex flex-col leading-tight">
              <span className="text-xs font-medium text-foreground">Nia Shah</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Waves className="w-3 h-3" /> Plant Ops · Supervisor
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
