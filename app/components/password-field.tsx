'use client'

import { useState } from 'react'

type Props = {
  id: string
  name?: string
  autoComplete: string
  minLength?: number
  pattern?: string
  title?: string
}

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="m3 3 18 18" />}
    </svg>
  )
}

export function PasswordField({ id, name = 'password', autoComplete, minLength, pattern, title }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-control">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        pattern={pattern}
        title={title}
        required
        className="password-input"
      />
      <button
        className="password-toggle"
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-controls={id}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        <EyeIcon crossed={visible} />
      </button>
    </div>
  )
}
