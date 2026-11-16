'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isValidEmail, isValidPassword } from '@/lib/validation.mjs'
import { isCompromisedPassword } from '@/lib/password-security.mjs'
import { resolveAuthOrigin } from '@/lib/request-origin.mjs'

function go(path: string, message: string): never {
  redirect(path + '?notice=' + encodeURIComponent(message))
}

async function authOrigin() {
  const requestHeaders = await headers()
  return resolveAuthOrigin(requestHeaders, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!isValidEmail(email)) go('/forgot-password', 'Enter a valid email address.')
  const supabase = await createClient()
  const origin = await authOrigin()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin + '/auth/recovery',
  })
  if (error) go('/forgot-password', 'We could not send the reset email. Please try again shortly.')
  go('/forgot-password', 'If an account exists for that address, a password reset link has been sent.')
}

export async function setNewPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  if (!isValidPassword(password)) go('/reset-password', 'Use at least 12 characters, including uppercase, lowercase and a number.')
  try {
    if (await isCompromisedPassword(password)) go('/reset-password', 'This password appears in known data breaches. Choose a different password.')
  } catch {
    go('/reset-password', 'We could not complete the password security check. Please try again shortly.')
  }
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) go('/forgot-password', 'Your reset link is invalid or expired. Request a new one.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) go('/reset-password', 'Your password could not be changed. Request a new reset link and try again.')
  await supabase.auth.signOut()
  go('/login', 'Password updated. Sign in with your new password after confirming your email remains verified.')
}
