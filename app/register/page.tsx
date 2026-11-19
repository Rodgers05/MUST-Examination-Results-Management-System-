import Link from 'next/link'
import { register, resendSignupConfirmation } from '@/app/auth-actions'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'
import { PasswordInput } from '@/app/components/password-input'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams
  return (
    <><PortalHeader nav /><main className="auth-wrap">
      <section className="auth-art"><div className="auth-brand-note">MUST RESULTS PORTAL</div><div><div className="kicker">STUDENT REGISTRATION</div><h1>Create your student account.</h1><p>Your account will be reviewed before you can sign in. Staff accounts are created by an administrator.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="kicker">REGISTER</div><h1>Register as a student</h1><p className="muted">Use an email address you can access.</p>
        {notice && <div className="notice error">{notice}</div>}
        <form action={register}>
          <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" autoComplete="name" minLength={2} maxLength={120} required /></div>
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={12} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,}" title="At least 12 characters, including uppercase, lowercase and a number." required /><small className="subtle">At least 12 characters, with uppercase, lowercase and a number.</small></div>
          <button type="submit">Create account</button>
        </form>
        <div className="auth-divider"><span>ALREADY REGISTERED?</span></div>
        <form action={resendSignupConfirmation}>
          <div className="field"><label htmlFor="resend_email">Resend email</label><input id="resend_email" name="email" type="email" autoComplete="email" placeholder="Enter your registered email" required /></div>
          <button type="submit" className="secondary-button">Resend email</button>
        </form>
        <p className="auth-foot">Already verified? <Link href="/login">Sign in</Link>. Your account also needs administrator approval.</p>
      </div></section>
    </main><PortalFooter /></>
  )
}
