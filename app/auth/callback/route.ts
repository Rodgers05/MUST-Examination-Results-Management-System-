import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeAppPath } from '@/lib/redirects.mjs'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const otpType = params.get('type')
  const destination = safeAppPath(params.get('next'))

  const supabase = await createClient()
  let verificationFailed = false

  // PKCE code flow is used by Google OAuth and Supabase's default confirmation
  // email template. Token-hash flow is supported for customised confirmation
  // templates that link to /auth/callback?token_hash=...&type=email.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    verificationFailed = Boolean(error)
  } else if (tokenHash && (otpType === 'email' || otpType === 'signup')) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    })
    verificationFailed = Boolean(error)
  } else {
    verificationFailed = true
  }

  if (!verificationFailed) {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!userError && user?.email_confirmed_at) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('id', user.id)
        .maybeSingle()

      // Fail closed if the profile trigger has not created a profile or the
      // account status cannot be read. Verification never assigns a role.
      if (!profileError && profile?.account_status === 'PENDING') {
        return NextResponse.redirect(new URL('/pending?verified=1', request.url))
      }
      if (!profileError && profile?.account_status === 'ACTIVE') {
        return NextResponse.redirect(new URL(destination, request.url))
      }
    }
  }

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL(
    '/login?notice=The confirmation link is invalid, expired, or could not be completed. Request a new email and try again.',
    request.url,
  ))
}
