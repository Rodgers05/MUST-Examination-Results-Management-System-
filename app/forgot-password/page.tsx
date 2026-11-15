import Link from 'next/link'
import { requestPasswordReset } from '@/app/auth-actions'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams
  return (
    <><PortalHeader nav /><main className="auth-wrap">
      <section className="auth-art"><div className="auth-brand-note">MUST ACCOUNT SECURITY</div><div><div className="kicker">PASSWORD RECOVERY</div><h1>Get back to your academic workspace.</h1><p>We will send a secure password-reset link to the email address associated with your account.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="kicker">ACCOUNT RECOVERY</div><h1>Forgot password?</h1><p className="muted">Enter your registered email address. If an account exists, a recovery link will be sent to it.</p>
        {notice && <div className="notice" role="status">{notice}</div>}
        <form action={requestPasswordReset}>
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <button type="submit">Send recovery link</button>
        </form>
        <p className="auth-foot"><Link href="/login">Return to sign in</Link></p>
      </div></section>
    </main><PortalFooter /></>
  )
}
