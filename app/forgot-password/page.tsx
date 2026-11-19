import Link from 'next/link'
import { requestPasswordReset } from '@/app/auth-actions'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams
  return (
    <><PortalHeader nav /><main className="auth-wrap">
      <section className="auth-art"><div className="auth-brand-note">MUST RESULTS PORTAL</div><div><div className="kicker">RESET PASSWORD</div><h1>Reset your password.</h1><p>Enter your email to get a password reset link.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="kicker">RESET PASSWORD</div><h1>Forgot password?</h1><p className="muted">Enter your account email. If it is registered, we will send a reset link.</p>
        {notice && <div className="notice" role="status">{notice}</div>}
        <form action={requestPasswordReset}>
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <button type="submit">Send reset link</button>
        </form>
        <p className="auth-foot"><Link href="/login">Back to sign in</Link></p>
      </div></section>
    </main><PortalFooter /></>
  )
}
