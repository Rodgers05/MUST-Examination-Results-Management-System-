import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'
import { PasswordField } from '@/app/components/password-field'
import { setNewPassword } from '@/app/auth/password-actions'

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/forgot-password?notice=Open a valid password reset link from your email.')
  return <><PortalHeader nav /><main className="auth-wrap"><section className="auth-art"><div className="auth-brand-note">ACCOUNT RECOVERY</div><div><div className="kicker">SECURE ACCESS</div><h1>Choose a new password.</h1><p>Your role and account status are not changed by a password reset.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section><section className="auth-card-wrap"><div className="auth-card"><div className="kicker">NEW PASSWORD</div><h1>Reset password</h1>{notice && <div className="notice error" role="alert">{notice}</div>}<form action={setNewPassword}><div className="field"><label htmlFor="password">New password</label><PasswordField id="password" autoComplete="new-password" minLength={12} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,}" title="At least 12 characters, including uppercase, lowercase and a number." /><small className="subtle">At least 12 characters, with uppercase, lowercase and a number.</small></div><button type="submit">Update password</button></form><p className="auth-foot"><Link href="/login">Return to sign in</Link></p></div></section></main><PortalFooter /></>
}
