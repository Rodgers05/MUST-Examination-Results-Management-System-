'use client'

import { useState } from 'react'

type PasswordInputProps = {
  id: string
  name: string
  autoComplete: string
  required?: boolean
  minLength?: number
  pattern?: string
  title?: string
}

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-control">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
      />
      <button
        id={props.id + '-visibility'}
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 9.3 4.1 10.5 7-.4 1-1.2 2.1-2.3 3.2M6.2 6.2C3.9 7.6 2.3 9.7 1.5 12c1.2 2.9 5.3 7 10.5 7 1.4 0 2.7-.3 3.9-.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M1.5 12S5.3 5 12 5s10.5 7 10.5 7-3.8 7-10.5 7S1.5 12 1.5 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
