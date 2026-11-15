import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MUST | Examination Results Management System',
  description: 'Secure academic records, examination processing and results management for Mbarara University of Science and Technology.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
