import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Plan the Space',
  description: 'Design your space to scale',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
