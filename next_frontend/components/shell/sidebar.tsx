"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Factory,
  Bell,
  BarChart3,
  Settings,
  ChevronsLeft,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/machines", label: "Machine Detail", icon: Factory },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: 3 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="sticky top-0 h-screen shrink-0 border-r border-border/60 bg-sidebar/60 backdrop-blur-xl z-30"
    >
      <div className="flex h-16 items-center gap-3 px-5 border-b border-border/60">
        <div className="relative grid place-items-center w-9 h-9 rounded-xl bg-primary/15 text-primary glow-primary">
          <Activity className="w-[18px] h-[18px]" strokeWidth={2.2} />
          <span className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-status-ok animate-pulse-ring" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
              EdgeSense
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              AI · v2.4
            </span>
          </div>
        )}
      </div>

      <nav className="px-3 py-5 space-y-1">
        {nav.map(({ href, label, icon: Icon, badge }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 h-10 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
            >
              {active && (
                <motion.span
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/5"
                  transition={{ type: "spring", stiffness: 350, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  "relative w-[18px] h-[18px] shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
                strokeWidth={2}
              />
              {!collapsed && (
                <span className="relative flex-1 truncate">{label}</span>
              )}
              {!collapsed && badge ? (
                <span className="relative inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-status-crit/15 text-status-crit text-[10px] font-semibold">
                  {badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="absolute inset-x-3 bottom-4 space-y-3">
        {!collapsed && (
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-status-ok" />
              Edge cluster online
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">
              12 devices streaming · 0 packet loss
            </p>
            <div className="mt-3 h-1 rounded-full bg-accent overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-violet-400"
                style={{ width: "82%" }}
              />
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center gap-2 w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          aria-label="Toggle sidebar"
        >
          <ChevronsLeft
            className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  )
}
