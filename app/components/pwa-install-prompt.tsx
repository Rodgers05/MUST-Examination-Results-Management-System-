'use client'

import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // The portal remains fully usable if offline support is unavailable.
        })
      }, { once: true })
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
      setVisible(true)
      setMessage('Add the MUST Results Portal to your home screen for quicker access.')
    }
    const onInstalled = () => {
      setVisible(false)
      setInstallEvent(null)
      setMessage('MUST Results Portal has been added to your device.')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installEvent) {
      setMessage('To add this portal, open your browser menu and choose “Install app” or “Add to Home screen”.')
      setVisible(true)
      return
    }
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      setMessage('Installation started. You can open MUST Results Portal from your home screen.')
      setInstallEvent(null)
    } else {
      setMessage('Installation was cancelled. You can add the portal later from your browser menu.')
    }
  }

  if (!visible) return null
  return (
    <aside className="pwa-install-toast" role="status" aria-live="polite">
      <span className="pwa-install-icon" aria-hidden="true">M</span>
      <div className="pwa-install-copy">
        <strong>MUST Results Portal</strong>
        <span>{message}</span>
      </div>
      <div className="pwa-install-actions">
        <button type="button" onClick={install}> <span aria-hidden="true">↓</span> {installEvent ? 'Install' : 'How to add'}</button>
        <button type="button" className="pwa-dismiss" aria-label="Dismiss install message" onClick={() => setVisible(false)}>×</button>
      </div>
    </aside>
  )
}
