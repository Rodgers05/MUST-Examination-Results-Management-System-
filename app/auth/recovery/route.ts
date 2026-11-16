import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/forgot-password?notice=The reset link is invalid or expired.', request.url))
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/forgot-password?notice=The reset link is invalid or expired. Request a new one.', request.url))
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/forgot-password?notice=The reset session could not be verified.', request.url))
  return NextResponse.redirect(new URL('/reset-password', request.url))
}
