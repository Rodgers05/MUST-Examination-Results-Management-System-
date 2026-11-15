import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    const destination = new URL('/dashboard?notice=Sign%20out%20could%20not%20be%20completed.%20Please%20try%20again.', request.url)
    return NextResponse.redirect(destination, { status: 303 })
  }

  const destination = new URL('/login?notice=You%20have%20signed%20out.', request.url)
  return NextResponse.redirect(destination, { status: 303 })
}
