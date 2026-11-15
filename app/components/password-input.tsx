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
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
