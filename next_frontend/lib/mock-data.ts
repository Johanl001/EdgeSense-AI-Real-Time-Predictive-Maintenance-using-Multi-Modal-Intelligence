export type MachineStatus = "normal" | "warning" | "critical" | "offline"

export type Machine = {
  id: string
  name: string
  location: string
  type: string
  status: MachineStatus
  health: number
  lastSeen: string
  rpm: number
  temp: number
}

export const machines: Machine[] = [
  {
    id: "MX-2041",
    name: "CNC Mill A1",
    location: "Line 01 · Bay 3",
    type: "CNC Mill",
    status: "normal",
    health: 94,
    lastSeen: "2s ago",
    rpm: 2840,
    temp: 62,
  },
  {
    id: "PX-8813",
    name: "Hydraulic Press B4",
    location: "Line 02 · Bay 1",
    type: "Press",
    status: "warning",
    health: 71,
    lastSeen: "1s ago",
    rpm: 0,
    temp: 78,
  },
  {
    id: "CN-3320",
    name: "Conveyor Drive C2",
    location: "Line 03 · Bay 5",
    type: "Conveyor",
    status: "normal",
    health: 89,
    lastSeen: "3s ago",
    rpm: 1420,
    temp: 54,
  },
  {
    id: "RB-5502",
    name: "Robotic Arm R7",
    location: "Line 01 · Bay 2",
    type: "Robotics",
    status: "critical",
    health: 42,
    lastSeen: "just now",
    rpm: 0,
    temp: 91,
  },
  {
    id: "CM-1107",
    name: "Air Compressor U3",
    location: "Utility · East",
    type: "Compressor",
    status: "normal",
    health: 96,
    lastSeen: "5s ago",
    rpm: 3100,
    temp: 58,
  },
  {
    id: "TB-9440",
    name: "Cooling Pump T9",
    location: "Utility · West",
    type: "Pump",
    status: "warning",
    health: 76,
    lastSeen: "2s ago",
    rpm: 1820,
    temp: 69,
  },
]

export type AlertItem = {
  id: string
  machineId: string
  machineName: string
  title: string
  description: string
  severity: "info" | "warning" | "critical"
  timestamp: string
  confidence: number
  recommendation: string
}

export const alerts: AlertItem[] = [
  {
    id: "alert-0041",
    machineId: "RB-5502",
    machineName: "Robotic Arm R7",
    title: "Bearing fault probability exceeded threshold",
    description:
      "Harmonic signature at 124 Hz indicates early-stage outer-race bearing wear. Vibration RMS elevated 38% above baseline.",
    severity: "critical",
    timestamp: "2 min ago",
    confidence: 94,
    recommendation:
      "Schedule bearing inspection within 48h. Reduce load to <60% until serviced.",
  },
  {
    id: "alert-0040",
    machineId: "PX-8813",
    machineName: "Hydraulic Press B4",
    title: "Anomalous acoustic pattern detected",
    description:
      "Broadband noise floor rose 12dB during idle cycle. Likely precursor to seal degradation.",
    severity: "warning",
    timestamp: "14 min ago",
    confidence: 81,
    recommendation: "Log next 3 cycles. Re-evaluate if trend continues.",
  },
  {
    id: "alert-0039",
    machineId: "TB-9440",
    machineName: "Cooling Pump T9",
    title: "Temperature drift above normal range",
    description:
      "Coolant temp climbed 4.2°C over 30 min — outside expected seasonal variance.",
    severity: "warning",
    timestamp: "38 min ago",
    confidence: 76,
    recommendation: "Verify flow rate. Inspect filter assembly.",
  },
  {
    id: "alert-0038",
    machineId: "MX-2041",
    machineName: "CNC Mill A1",
    title: "Spindle calibration drift",
    description:
      "Sub-millimeter drift detected across last 200 parts. Still within tolerance.",
    severity: "info",
    timestamp: "1 h ago",
    confidence: 68,
    recommendation: "Recalibrate during next shift changeover.",
  },
  {
    id: "alert-0037",
    machineId: "CN-3320",
    machineName: "Conveyor Drive C2",
    title: "Belt tension variance",
    description:
      "Load cell reports +7% tension delta on left rail — asymmetric wear suspected.",
    severity: "info",
    timestamp: "3 h ago",
    confidence: 62,
    recommendation: "Visual inspection recommended.",
  },
]

export const explainability = [
  { feature: "Vibration RMS (124 Hz)", value: 0.38, direction: "up" as const },
  { feature: "Acoustic Kurtosis", value: 0.24, direction: "up" as const },
  { feature: "Bearing Envelope Energy", value: 0.19, direction: "up" as const },
  { feature: "Temperature Gradient", value: 0.11, direction: "up" as const },
  { feature: "Spectral Centroid Shift", value: 0.06, direction: "up" as const },
  { feature: "Load Stability", value: -0.08, direction: "down" as const },
]

export const faultTimeline = [
  { time: "T-72h", label: "Baseline drift begins", severity: "info" as const },
  { time: "T-36h", label: "Harmonic spike at 124 Hz", severity: "warning" as const },
  { time: "T-8h", label: "Acoustic anomaly cluster", severity: "warning" as const },
  { time: "Now", label: "Predicted bearing failure", severity: "critical" as const },
  { time: "T+48h", label: "Confidence window closes", severity: "info" as const },
]

// Deterministic pseudo-random to avoid hydration mismatches
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export function generateHeatmap(weeks = 26) {
  const rand = seeded(42)
  const cells: { day: number; week: number; value: number }[] = []
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const base = Math.max(0, Math.min(1, rand() * 1.1 - 0.1))
      // occasional spikes
      const spike = rand() > 0.94 ? rand() * 0.6 : 0
      cells.push({ day: d, week: w, value: Math.min(1, base + spike) })
    }
  }
  return cells
}

export function generateSpectrogram(cols = 64, rows = 16) {
  const rand = seeded(7)
  const data: number[][] = []
  for (let y = 0; y < rows; y++) {
    const row: number[] = []
    for (let x = 0; x < cols; x++) {
      // create a smooth horizontal band pattern with a localized hotspot
      const band = Math.exp(-Math.pow((y - 6) / 3.2, 2))
      const hotspot =
        x > cols * 0.55 && x < cols * 0.72 && y > 3 && y < 9
          ? 0.5 + rand() * 0.4
          : 0
      const noise = rand() * 0.25
      row.push(Math.min(1, band * 0.6 + noise * 0.4 + hotspot))
    }
    data.push(row)
  }
  return data
}

export function generateWaveSeries(points = 60, seed = 1, amp = 1, base = 0.5) {
  const rand = seeded(seed)
  const arr: number[] = []
  let prev = base
  for (let i = 0; i < points; i++) {
    const target = base + Math.sin(i / 5) * 0.25 * amp + (rand() - 0.5) * 0.2 * amp
    prev = prev + (target - prev) * 0.5
    arr.push(prev)
  }
  return arr
}
