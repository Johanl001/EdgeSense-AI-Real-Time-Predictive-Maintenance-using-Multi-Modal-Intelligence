"use client"

import { motion } from "framer-motion"
import { explainability } from "@/lib/mock-data"

export function ExplainabilityPanel() {
  const max = Math.max(...explainability.map((f) => Math.abs(f.value)))
  return (
    <div className="space-y-3">
      {explainability.map((f, i) => {
        const pct = (Math.abs(f.value) / max) * 100
        const positive = f.value > 0
        return (
          <div key={f.feature}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground/90">{f.feature}</span>
              <span
                className={`font-mono tabular-nums ${positive ? "text-status-crit" : "text-status-ok"}`}
              >
                {positive ? "+" : "−"}
                {Math.abs(f.value).toFixed(2)}
              </span>
            </div>
            <div className="mt-1.5 relative h-2 rounded-full bg-accent/70 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${
                  positive
                    ? "bg-gradient-to-r from-status-alert to-status-crit"
                    : "bg-gradient-to-r from-primary to-status-ok"
                }`}
                style={{
                  boxShadow: positive
                    ? "0 0 12px rgba(239,68,68,0.35)"
                    : "0 0 12px rgba(34,197,94,0.3)",
                }}
              />
            </div>
          </div>
        )
      })}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60 text-[11px] text-muted-foreground">
        <span>Contributes to fault</span>
        <span>Protects against fault</span>
      </div>
    </div>
  )
}
