"use client"

import { motion } from "framer-motion"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-radial-fade" aria-hidden />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.35] mask-fade-b" aria-hidden />

      <div className="relative flex">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <Topbar />
          <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="px-6 lg:px-8 py-8 max-w-[1600px] mx-auto"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  )
}
