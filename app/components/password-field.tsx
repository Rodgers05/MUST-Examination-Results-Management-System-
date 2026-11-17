'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = {
  id: string
  name?: string
  autoComplete: string
  minLength?: number
  pattern?: string
  title?: string
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
        {visible ? <EyeOff size={20} strokeWidth={2} aria-hidden="true" /> : <Eye size={20} strokeWidth={2} aria-hidden="true" />}
      </button>
    </div>
  )
}
