'use client'

import { useEffect } from 'react'

export function ThemeBootstrap() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem('must-theme')
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        document.documentElement.dataset.theme = saved
      }
    } catch {
      document.documentElement.dataset.theme = 'system'
    }
  }, [])
  return null
}
