'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isValidEmail, isValidPassword } from '@/lib/validation.mjs'
import { safeAppPath } from '@/lib/redirects.mjs'
import { resolveAuthOrigin } from '@/lib/request-origin.mjs'

async function getAuthOrigin() {
  const requestHeaders = await headers()
  const fallbackOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return resolveAuthOrigin(requestHeaders, fallbackOrigin)
}

function note(path: string, value: string): never {
  redirect(path + '?notice=' + encodeURIComponent(value))
}

function emailDeliveryFailure(error: { message?: string; code?: string }) {
  const detail = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (detail.includes('550') || detail.includes('testing emails') || detail.includes('verify a domain')) {
    return 'We could not send the confirmation email. The administrator needs to finish setting up email delivery.'
  }
  if (detail.includes('535') || detail.includes('authentication credentials invalid')) {
    return 'Email delivery is not set up correctly. Contact the administrator.'
  }
  if (error.code === 'unexpected_failure') {
    return 'We could not create your account because the confirmation email was not sent. Contact the administrator and try again later.'
  }
  if (error.code === 'over_email_send_rate_limit' || detail.includes('rate limit')) {
    return 'Too many emails were requested. Wait a few minutes and try again.'
  }
  return 'We could not send the email. Contact the administrator.'
}

export async function register(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (fullName.length < 2 || fullName.length > 120) note('/register', 'Enter your name (2–120 characters).')
  if (!isValidEmail(email)) note('/register', 'Enter your MUST institutional email address.')
  if (!isValidPassword(password)) note('/register', 'Use 12 or more characters, with uppercase and lowercase letters and a number.')

  const supabase = await createClient()
  const origin = await getAuthOrigin()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: origin + '/auth/callback?next=%2Fdashboard',
    },
  })
  if (error?.code === 'email_provider_disabled') note('/register', 'Registration is unavailable right now. Contact the administrator.')
  if (error) note('/register', error.code === 'unexpected_failure' ? emailDeliveryFailure(error) : 'We could not create your account. Check your details and try again.')
  if (data.session) {
    await supabase.auth.signOut()
    note('/login', 'Email verification is required. Check your inbox before signing in.')
  }
  note('/login', 'Check your email for the verification link. Your account also needs approval.')
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const next = safeAppPath(formData.get('next'))
  if (!isValidEmail(email) || !password) note('/login', 'Enter your email and password.')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.code === 'email_not_confirmed') {
      note('/login', 'Verify your email first. Use the resend option on the registration page if needed.')
    }
    if (error.code === 'user_banned') {
      note('/login', 'Your account is suspended. Contact the administrator.')
    }
    if (error.code === 'too_many_requests') {
      note('/login', 'Too many attempts. Wait a few minutes and try again.')
    }
    if (error.code === 'invalid_credentials') {
      note('/login', 'Sign-in failed. Check your email and password. Register first if you do not have an account.')
    }
    note('/login', 'Sign-in failed. Try again shortly or contact the administrator.')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email_confirmed_at) {
    await supabase.auth.signOut()
    note('/login', 'Verify your email address before signing in.')
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (claimsError || !claims || typeof claims.sub !== 'string') {
    await supabase.auth.signOut()
    note('/login', 'We could not verify your session. Try again.')
  }
  const userId = claims.sub

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status,email_verified')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || !profile.email_verified) {
    await supabase.auth.signOut()
    note('/login', 'Verify your email address before signing in.')
  }
  if (profile.account_status === 'PENDING') redirect('/pending')
  if (profile.account_status !== 'ACTIVE') {
    await supabase.auth.signOut()
    note('/login', 'Your account is not active. Contact the administrator.')
  }
  redirect(next)
}

export async function googleSignIn() {
  const supabase = await createClient()
  const origin = await getAuthOrigin()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin + '/auth/callback?next=%2Fdashboard',
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error || !data.url) {
    note('/login', 'Google sign-in is not available yet. Contact the administrator.')
  }
  redirect(data.url)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login?notice=You%20have%20signed%20out.')
}


export async function resendSignupConfirmation(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!isValidEmail(email)) note('/register', 'Enter your MUST institutional email address.')

  const supabase = await createClient()
  const origin = await getAuthOrigin()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: origin + '/auth/callback?next=%2Fdashboard',
    },
  })

  if (error) note('/register', emailDeliveryFailure(error))
  note('/register', 'If the account needs verification, we have requested a new email. Check your inbox and spam folder.')
}


export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!isValidEmail(email)) note('/forgot-password', 'Enter a valid email address.')

  const supabase = await createClient()
  const origin = await getAuthOrigin()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin + '/auth/callback?next=%2Freset-password',
  })
  if (error) note('/forgot-password', 'We could not send a reset link. Wait a moment and try again.')
  note('/forgot-password', 'If the email is registered, a reset link has been sent. Check your inbox and spam folder.')
}

export async function updateRecoveredPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('confirm_password') ?? '')
  if (!isValidPassword(password)) note('/reset-password', 'Use 12 or more characters, with uppercase and lowercase letters and a number.')
  if (password !== confirmation) note('/reset-password', 'The passwords do not match.')

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) note('/forgot-password', 'Your reset link has expired. Request a new one.')

  const { error } = await supabase.auth.updateUser({ password })
  if (error) note('/reset-password', 'We could not save the password. Request a new reset link and try again.')
  await supabase.auth.signOut()
  note('/login', 'Password changed. Sign in with your new password.')
}
