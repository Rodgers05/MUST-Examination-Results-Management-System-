import Link from 'next/link'
import { redirect } from 'next/navigation'
import { updateRecoveredPassword } from '@/app/auth-actions'
import { PasswordInput } from '@/app/components/password-input'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'
import { createClient } from '@/lib/supabase/server'

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/forgot-password?notice=' + encodeURIComponent('Open the latest password recovery link from your email to continue.'))
  return (
    <><PortalHeader nav /><main className="auth-wrap">
      <section className="auth-art"><div className="auth-brand-note">MUST ACCOUNT SECURITY</div><div><div className="kicker">SECURE PASSWORD UPDATE</div><h1>Choose a new password.</h1><p>Use a strong password that you do not use on another website.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="kicker">RESET PASSWORD</div><h1>Create a new password</h1>
        <p className="muted">Your new password must contain at least 12 characters, including uppercase, lowercase and a number.</p>
        {notice && <div className="notice error" role="alert">{notice}</div>}
        <form action={updateRecoveredPassword}>
          <div className="field"><label htmlFor="password">New password</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={12} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,}" title="At least 12 characters, including uppercase, lowercase and a number." required /></div>
          <div className="field"><label htmlFor="confirm_password">Confirm new password</label><PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" minLength={12} required /></div>
          <button type="submit">Save new password</button>
        </form>
        <p className="auth-foot"><Link href="/login">Return to sign in</Link></p>
      </div></section>
    </main><PortalFooter /></>
  )
}
