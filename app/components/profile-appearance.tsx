'use client'

import { useEffect, useState } from 'react'

export function ProfileAppearance({ initialTheme }: { initialTheme: string }) {
  const [theme, setTheme] = useState(['light', 'dark', 'system'].includes(initialTheme) ? initialTheme : 'system')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('must-theme', theme) } catch { /* storage may be unavailable */ }
  }, [theme])
  return <div className="field"><label htmlFor="theme_preference">Appearance</label>
    <select id="theme_preference" name="theme_preference" value={theme} onChange={(event) => setTheme(event.target.value)}>
      <option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  </div>
}
