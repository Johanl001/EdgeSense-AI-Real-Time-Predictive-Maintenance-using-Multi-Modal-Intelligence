"use client"

import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

type Props = HTMLMotionProps<"div"> & {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  padded?: boolean
}

export function SectionCard({
  title,
  subtitle,
  action,
  padded = true,
  className,
  children,
  ...rest
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass rounded-2xl relative overflow-hidden",
        "hover:border-border/80 transition-colors",
        className
      )}
      {...rest}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            {title && (
              <h3 className="font-display text-[15px] font-semibold text-foreground tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(padded ? "p-5" : "")}>{children}</div>
    </motion.div>
  )
}
