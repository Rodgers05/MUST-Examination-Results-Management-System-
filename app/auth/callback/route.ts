import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidEmail } from '@/lib/validation.mjs'
import { safeAppPath } from '@/lib/redirects.mjs'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const destination = safeAppPath(request.nextUrl.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (!userError && user) {
        if (!user.email || !isValidEmail(user.email)) {
          await supabase.auth.signOut()
          return NextResponse.redirect(new URL('/login?notice=Use%20your%20MUST%20institutional%20email%20address.', request.url))
        }

        // Recovery links establish a temporary session. The user may update
        // their password without an active profile, but must still use MUST email.
        if (destination === '/reset-password') {
          return NextResponse.redirect(new URL('/reset-password', request.url))
        }

        if (user.email_confirmed_at) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('account_status,email_verified')
            .eq('id', user.id)
            .maybeSingle()

          if (!profileError && profile?.email_verified && profile.account_status === 'PENDING') {
            return NextResponse.redirect(new URL('/pending', request.url))
          }

          if (!profileError && profile?.email_verified && profile.account_status === 'ACTIVE') {
            return NextResponse.redirect(new URL(destination, request.url))
          }
        }
      }

      await supabase.auth.signOut()
    }
  }

  return NextResponse.redirect(new URL('/login?notice=Sign-in%20could%20not%20be%20completed.%20Verify%20your%20email%20or%20contact%20the%20examinations%20administrator.', request.url))
}
