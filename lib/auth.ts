import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AppRole = 'ADMIN' | 'LECTURER' | 'REVIEWER' | 'REGISTRAR' | 'STUDENT'
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export type Profile = {
  id: string
  institutional_email: string
  full_name: string
  student_number: string | null
  staff_number: string | null
  department_id: string | null
  role: AppRole
  account_status: AccountStatus
  email_verified: boolean
  avatar_path: string | null
  theme_preference: 'light' | 'dark' | 'system'
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const userId = claims?.sub
  if (claimsError || typeof userId !== 'string') return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id,institutional_email,full_name,student_number,staff_number,department_id,role,account_status,email_verified,avatar_path,theme_preference')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as Profile
}

export async function requireActiveProfile(roles?: AppRole[]) {
  const profile = await getProfile()
  if (!profile) redirect('/login?notice=Please%20sign%20in%20again.')
  // Activation and inbox ownership are separate controls. An ACTIVE profile
  // must still prove email ownership before entering any protected workspace.
  if (!profile.email_verified) {
    redirect('/login?notice=Verify%20your%20email%20address%20before%20accessing%20the%20portal.')
  }
  if (profile.account_status === 'PENDING') redirect('/pending')
  if (profile.account_status !== 'ACTIVE') redirect('/login?notice=This%20account%20is%20not%20active.')
  if (roles && !roles.includes(profile.role)) redirect('/dashboard?notice=You%20do%20not%20have%20access%20to%20that%20action.')
  return profile
}
