import Link from 'next/link'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'
import { requestPasswordReset } from '@/app/auth/password-actions'

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams
  return <><PortalHeader nav /><main className="auth-wrap"><section className="auth-art"><div className="auth-brand-note">ACCOUNT RECOVERY</div><div><div className="kicker">SECURE ACCESS</div><h1>Get back into your account.</h1><p>We will send a secure reset link to the email address associated with your account.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section><section className="auth-card-wrap"><div className="auth-card"><div className="kicker">PASSWORD RESET</div><h1>Forgot password?</h1><p className="muted">Enter your verified account email. If an account exists, we will send a reset link.</p>{notice && <div className="notice" role="status">{notice}</div>}<form action={requestPasswordReset}><div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div><button type="submit">Send reset link</button></form><p className="auth-foot"><Link href="/login">Return to sign in</Link></p></div></section></main><PortalFooter /></>
}
