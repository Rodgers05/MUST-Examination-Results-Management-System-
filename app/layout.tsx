import type { Metadata } from 'next'
import './globals.css'
import { ThemeBootstrap } from '@/app/components/theme-bootstrap'
import { PwaInstallPrompt } from '@/app/components/pwa-install-prompt'

export const metadata: Metadata = {
  title: 'MUST | Examination Results Management System',
  description: 'Secure academic records, examination processing and results management for Mbarara University of Science and Technology.',
  applicationName: 'MUST Results Portal',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'MUST Results', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { icon: '/pwa-icon.svg', apple: '/pwa-icon.svg' },
}

export const viewport = {
  themeColor: '#142D68',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="system"><body><ThemeBootstrap />{children}<PwaInstallPrompt /></body></html>
}
