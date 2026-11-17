'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isMustInstitutionalEmail, isValidEmail, isValidPassword } from '@/lib/validation.mjs'
import { safeAppPath } from '@/lib/redirects.mjs'
import { isCompromisedPassword } from '@/lib/password-security.mjs'
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
    return 'Confirmation email delivery is blocked because the Resend sender domain is still in testing mode. The administrator must verify the domain in Resend and use its verified sender address in Supabase SMTP settings.'
  }
  if (detail.includes('535') || detail.includes('authentication credentials invalid')) {
    return 'Confirmation email delivery is misconfigured. The administrator must update the SMTP username and API-key password in Supabase Authentication settings.'
  }
  if (error.code === 'unexpected_failure') {
    return 'Your account could not be created because the confirmation email service rejected the message. Resend is still in testing mode: the administrator must verify a sending domain in Resend and set the Supabase SMTP sender address to an address on that verified domain. No usable account has been created; please try again after the email service is fixed.'
  }
  if (error.code === 'over_email_send_rate_limit' || detail.includes('rate limit')) {
    return 'Too many confirmation emails have been requested. Wait a few minutes before trying again.'
  }
  return 'We could not send a confirmation email. Check the email service configuration or contact the system administrator.'
}

export async function register(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (fullName.length < 2 || fullName.length > 120) note('/register', 'Enter your name (2–120 characters).')
  if (!isValidEmail(email)) note('/register', 'Enter a valid email address.')
  if (!isMustInstitutionalEmail(email)) note('/register', 'Use your MUST institutional email address ending in @must.ac.ug or @std.must.ac.ug.')
  if (!isValidPassword(password)) note('/register', 'Use at least 12 characters, including an uppercase letter, a lowercase letter and a number.')
  let compromisedPassword = false
  try {
    compromisedPassword = await isCompromisedPassword(password)
  } catch {
    note('/register', 'We could not complete the password security check. Please try again shortly.')
  }
  if (compromisedPassword) note('/register', 'This password appears in known data breaches. Choose a different password that you have not used on another service.')

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
  if (error?.code === 'email_provider_disabled') note('/register', 'Email registration is currently disabled. The administrator must enable the Email provider in Supabase Authentication settings.')
  if (error) note('/register', error.code === 'unexpected_failure' ? emailDeliveryFailure(error) : 'We could not create this account. Check your details and try again.')
  if (data.session) {
    await supabase.auth.signOut()
    note('/login', 'Email verification is required. Check your inbox before signing in.')
  }
  note('/login', 'Check your inbox to verify your email. New accounts remain pending until approved.')
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const next = safeAppPath(formData.get('next'))
  if (!password) note('/login', 'Enter your password.')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.code === 'email_not_confirmed') {
      note('/login', 'Your email address has not been verified. Open the confirmation email and follow its link. If you never received it, use the resend option on the registration page.')
    }
    if (error.code === 'user_banned') {
      note('/login', 'This account is currently suspended. Contact the examinations administrator.')
    }
    if (error.code === 'too_many_requests') {
      note('/login', 'Too many sign-in attempts. Wait a few minutes and try again.')
    }
    if (error.code === 'invalid_credentials') {
      note('/login', 'We could not sign you in. Check your email and password. If this is your first visit, create an account first. A failed registration caused by email-delivery problems will not create a usable login.')
    }
    note('/login', 'The authentication service could not complete sign-in. Please try again shortly or contact the system administrator.')
  }

  const user = data.user
  if (!user?.email_confirmed_at) {
    await supabase.auth.signOut()
    note('/login', 'Verify your email address before signing in.')
  }

  const userId = user.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.account_status === 'PENDING') redirect('/pending')
  if (profile?.account_status !== 'ACTIVE') {
    await supabase.auth.signOut()
    note('/login', 'This account is not active. Contact the examinations administrator.')
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
    note('/login', 'Google sign-in is not enabled yet. Configure the Google provider in Supabase Auth, then try again.')
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
  if (!isValidEmail(email)) note('/register', 'Enter the valid email address used during registration.')

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
  note('/register', 'If this address has an unconfirmed account, a new confirmation email has been requested. Check your inbox and spam folder.')
}
