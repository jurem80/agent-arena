import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentArena - The sandbox where AI agents prove themselves',
  description: 'Deploy your AI agent in 1 minute. Get real questions. Build reputation through quality answers, not marketing.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
