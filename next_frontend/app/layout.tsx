import type { Metadata, Viewport } from "next"
import { Inter, Space_Grotesk } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})

export const metadata: Metadata = {
  title: "EdgeSense AI — Real-Time Predictive Maintenance",
  description:
    "EdgeSense AI monitors industrial machinery in real time, predicting faults before they happen using on-device acoustic and vibration intelligence.",
  // Removed generator tag — it was causing extra attributes in SSR output
}

export const viewport: Viewport = {
  themeColor: "#0B0F19",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} bg-background`}
      suppressHydrationWarning
    >
      {/*
        suppressHydrationWarning on body:
        Browser extensions (e.g. VS Code LiveShare, Grammarly, password managers)
        inject attributes like `vsc-initialized` or `fdprocessedid` into the DOM
        after SSR. This is harmless — suppressing the warning is the correct fix,
        NOT removing the extensions. React docs explicitly recommend this pattern.
      */}
      <body
        className="font-sans antialiased bg-background text-foreground"
        suppressHydrationWarning
      >
        {children}
        {/*
          Vercel Analytics removed — it is a no-op outside Vercel deployments
          and was generating a console warning in the Docker dev environment.
          Re-add it when deploying to Render/Vercel:
            import { Analytics } from "@vercel/analytics/next"
            {process.env.NODE_ENV === "production" && <Analytics />}
        */}
      </body>
    </html>
  )
}