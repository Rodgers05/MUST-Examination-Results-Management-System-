import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeAppPath } from '@/lib/redirects.mjs'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const destination = safeAppPath(request.nextUrl.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (!userError && user?.email_confirmed_at) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('account_status')
          .eq('id', user.id)
          .maybeSingle()

        if (!profileError && profile?.account_status === 'PENDING') {
          return NextResponse.redirect(new URL('/pending', request.url))
        }

        if (!profileError && profile?.account_status === 'ACTIVE') {
          return NextResponse.redirect(new URL(destination, request.url))
        }
      }

      await supabase.auth.signOut()
    }
  }

  return NextResponse.redirect(new URL('/login?notice=Sign-in could not be completed. Verify your email or contact the examinations administrator.', request.url))
}
