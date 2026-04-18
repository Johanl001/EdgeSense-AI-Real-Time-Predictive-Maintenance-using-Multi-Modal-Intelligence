"use client"

import { useEffect, useRef, useState } from "react"
import { generateWaveSeries } from "@/lib/mock-data"

type Props = {
  color?: string
  seed?: number
  height?: number
  amp?: number
  base?: number
  ariaLabel?: string
}

const POINTS = 80

export function RealtimeChart({
  color = "#0EA5E9",
  seed = 1,
  height = 160,
  amp = 1,
  base = 0.5,
  ariaLabel = "Real-time telemetry",
}: Props) {
  // ── Key fix: start with null so SSR renders nothing (no mismatch).
  // The chart is only rendered client-side after mount.
  const [data, setData] = useState<number[] | null>(null);
  const tick = useRef(0);

  // Populate data only on the client after first mount
  useEffect(() => {
    setData(generateWaveSeries(POINTS, seed, amp, base));
  }, [seed, amp, base]);

  // Live update loop — only runs after data is initialised
  useEffect(() => {
    if (data === null) return;

    const rnd = () => {
      tick.current += 1;
      const t = tick.current;
      return (
        base +
        Math.sin(t / 5) * 0.25 * amp +
        (Math.random() - 0.5) * 0.22 * amp
      );
    };

    const id = setInterval(() => {
      setData((prev) => {
        if (!prev) return prev;
        const next = prev.slice(1);
        const last = prev[prev.length - 1];
        const target = rnd();
        const val = last + (target - last) * 0.55;
        next.push(Math.max(0.02, Math.min(0.98, val)));
        return next;
      });
    }, 900);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data === null, amp, base]); // re-run only when data goes from null → array

  const W = 600;
  const H = height;
  const pad = 8;
  const stepX = (W - pad * 2) / (POINTS - 1);

  // While not yet mounted, render an empty placeholder with the same dimensions
  // so layout doesn't shift. This avoids any SSR/client mismatch entirely.
  if (data === null) {
    return (
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      />
    );
  }

  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - v) * (H - pad * 2);
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");

  const areaPath =
    linePath +
    ` L ${pad + (POINTS - 1) * stepX} ${H - pad} L ${pad} ${H - pad} Z`;

  const last = points[points.length - 1];
  const gradId = `line-grad-${seed}`;
  const areaId = `area-grad-${seed}`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        <linearGradient id={areaId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((f) => {
        const y = pad + f * (H - pad * 2);
        return (
          <line
            key={f}
            x1={pad}
            x2={W - pad}
            y1={y}
            y2={y}
            stroke="rgba(148,163,184,0.08)"
            strokeDasharray="2 4"
          />
        );
      })}

      <path d={areaPath} fill={`url(#${areaId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Live point */}
      <circle cx={last[0]} cy={last[1]} r={8} fill={color} opacity={0.15} />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
    </svg>
  );
}