'use client'

import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'must-pwa-install-dismissed'

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    let dismissed = false
    try { dismissed = window.localStorage.getItem(DISMISSED_KEY) === '1' } catch { /* storage may be unavailable */ }

    if ('serviceWorker' in navigator) {
      // Register immediately after hydration so this also works when the load
      // event has already fired before the component mounts.
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // The portal remains fully usable if offline support is unavailable.
      })
    }

    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    const manualInstructions = isIOS
      ? 'To install, open this page in Safari, tap Share, then choose “Add to Home Screen”.'
      : 'Add this portal to your home screen from your browser menu, or install it when your browser offers the install option.'

    let initialPromptFrame: number | null = null
    if (!dismissed) {
      initialPromptFrame = window.requestAnimationFrame(() => {
        setMessage(manualInstructions)
        setVisible(true)
      })
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
      if (!dismissed) {
        setVisible(true)
        setMessage('Install MUST Results Portal for quick access from your home screen.')
      }
    }

    const onInstalled = () => {
      setVisible(false)
      setInstallEvent(null)
      try { window.localStorage.setItem(DISMISSED_KEY, '1') } catch { /* storage may be unavailable */ }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      if (initialPromptFrame !== null) window.cancelAnimationFrame(initialPromptFrame)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installEvent) {
      const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
      setMessage(isIOS
        ? 'In Safari, tap the Share icon, scroll the options and select “Add to Home Screen”, then confirm Add.'
        : 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”. The wording depends on your browser.')
      setVisible(true)
      return
    }

    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setInstallEvent(null)
    if (choice.outcome === 'accepted') {
      setMessage('Installation was accepted. Open MUST Results Portal from your home screen.')
    } else {
      setMessage('Installation was cancelled. You can add the portal later from your browser menu.')
    }
  }

  function dismiss() {
    setVisible(false)
    try { window.localStorage.setItem(DISMISSED_KEY, '1') } catch { /* storage may be unavailable */ }
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
        <button type="button" onClick={install}>
          <span aria-hidden="true">↓</span> {installEvent ? 'Install app' : 'Add to Home'}
        </button>
        <button type="button" className="pwa-dismiss" aria-label="Dismiss install message" onClick={dismiss}>×</button>
      </div>
    </aside>
  )
}
