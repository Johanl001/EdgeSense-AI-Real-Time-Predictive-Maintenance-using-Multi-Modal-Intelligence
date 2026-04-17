"use client"

import { generateHeatmap } from "@/lib/mock-data"
import { useMemo } from "react"

type Props = {
  weeks?: number
}

export function HeatmapGrid({ weeks = 26 }: Props) {
  const cells = useMemo(() => generateHeatmap(weeks), [weeks])
  const weekCols: { day: number; week: number; value: number }[][] = Array.from(
    { length: weeks },
    () => []
  )
  cells.forEach((c) => weekCols[c.week].push(c))

  const colorFor = (v: number) => {
    if (v < 0.08) return "rgba(148,163,184,0.08)"
    if (v < 0.25) return "rgba(14,165,233,0.22)"
    if (v < 0.45) return "rgba(14,165,233,0.45)"
    if (v < 0.7) return "rgba(234,179,8,0.55)"
    if (v < 0.85) return "rgba(249,115,22,0.7)"
    return "rgba(239,68,68,0.85)"
  }

  const dayLabels = ["Mon", "Wed", "Fri"]

  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <div className="inline-flex gap-2">
        <div className="flex flex-col justify-between py-1 pr-1 text-[10px] text-muted-foreground font-mono select-none">
          {dayLabels.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="flex gap-1">
          {weekCols.map((col, i) => (
            <div key={i} className="flex flex-col gap-1">
              {col.map((cell) => (
                <div
                  key={`${cell.week}-${cell.day}`}
                  className="w-3 h-3 rounded-[3px] transition-transform hover:scale-125 hover:ring-1 hover:ring-primary/50"
                  style={{ backgroundColor: colorFor(cell.value) }}
                  title={`Week ${cell.week + 1} · Day ${cell.day + 1} · ${Math.round(
                    cell.value * 100
                  )}% anomaly`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          {[0.05, 0.2, 0.4, 0.6, 0.8, 0.95].map((v) => (
            <span
              key={v}
              className="w-3 h-3 rounded-[3px]"
              style={{ backgroundColor: colorFor(v) }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  )
}
