"use client"

import { motion } from "framer-motion"

type Props = {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8"
    >
      <div className="min-w-0">
        {eyebrow && (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-primary">
            <span className="w-1 h-1 rounded-full bg-primary" />
            {eyebrow}
          </span>
        )}
        <h1 className="mt-2 font-display text-3xl md:text-[34px] font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  )
}
